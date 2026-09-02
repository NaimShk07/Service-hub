import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { BookingRepository } from "../repositories/booking.repository";
import { ProviderServiceRepository } from "@modules/provider/repositories/provider-service.repository";
import { ProviderAvailabilityRepository } from "@modules/provider/repositories/provider-availability.repositor";
import { CreateBookingDto } from "../dto/create-booking.dto";
import { QueryBookingsDto } from "../dto/query-booking.dto";
import { CancelBookingDto } from "../dto/cancel-booking.dto";
import {
  AuditAction,
  BookingStatus,
  PaymentGateway,
  PaymentStatus,
  UserStatus,
  VerificationStatus,
} from "@prisma-client/enums";
import { canTransitionBooking } from "../domain/booking-state-machine";
import { PrismaService } from "@database/prisma/prisma.service";
import { Prisma } from "@prisma-client/client";
import { PAYMENT_GATEWAY } from "@modules/payment/gateway/payment-gateway.token";
import { IPaymentGateway } from "@modules/payment/gateway/payment-gateway.interface";
import { toSmallestCurrencyUnit } from "@common/utils/currency.util";

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly providerServiceRepository: ProviderServiceRepository,
    private readonly providerAvailabilityRepository: ProviderAvailabilityRepository,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: IPaymentGateway,
    private readonly prisma: PrismaService,
  ) {}

  async createBooking(customerId: string, dto: CreateBookingDto) {
    this.logger.log(`Initiating booking creation for customer: ${customerId}`);

    // 1. Fetch Provider Service Offering
    const providerService = await this.providerServiceRepository.findById(
      dto.providerServiceId,
    );
    if (!providerService || !providerService.isActive) {
      throw new NotFoundException(
        "Provider service offering not found or inactive",
      );
    }
    const provider = providerService.provider;
    if (
      !provider ||
      provider.verificationStatus !== VerificationStatus.VERIFIED
    ) {
      throw new BadRequestException("Provider profile is not verified");
    }
    if (provider.user?.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        "Provider account is currently suspended or inactive",
      );
    }

    // 2. Validate Booking Date & 30-day window
    const startsAtDate = new Date(dto.startsAt);
    if (isNaN(startsAtDate.getTime())) {
      throw new BadRequestException("Invalid date format for startsAt");
    }
    if (startsAtDate < new Date()) {
      throw new BadRequestException("Booking start time cannot be in the past");
    }
    const maxAdvanceDate = new Date();
    maxAdvanceDate.setDate(maxAdvanceDate.getDate() + 30);
    if (startsAtDate > maxAdvanceDate) {
      throw new BadRequestException(
        "Bookings can only be scheduled up to 30 days in advance",
      );
    }

    // 3. Validate Provider Working Hours & Shift
    const requestedWeekday = startsAtDate.getUTCDay();
    const schedules =
      await this.providerAvailabilityRepository.findByProviderId(
        providerService.providerId,
      );
    const daySchedules = schedules.filter(
      (s) => s.weekday === requestedWeekday && s.isAvailable === true,
    );
    if (daySchedules.length === 0) {
      throw new BadRequestException(
        "Provider is not available on this day of the week",
      );
    }
    const startMinutes =
      startsAtDate.getUTCHours() * 60 + startsAtDate.getUTCMinutes();
    const occupiedEndMinutes =
      startMinutes +
      providerService.durationMinutes +
      (providerService.bufferMinutes || 0);
    const fitsInShift = daySchedules.some((shift) => {
      const [startH, startM] = shift.startTime.split(":").map(Number);
      const [endH, endM] = shift.endTime.split(":").map(Number);
      const shiftStart = startH * 60 + startM;
      const shiftEnd = endH * 60 + endM;
      return startMinutes >= shiftStart && occupiedEndMinutes <= shiftEnd;
    });
    if (!fitsInShift) {
      throw new BadRequestException(
        "Requested booking slot (including post-service buffer) exceeds provider working shift hours",
      );
    }

    // 4. Calculate Server-Side End Time & Date
    const durationMs = providerService.durationMinutes * 60 * 1000;
    const endsAtDate = new Date(startsAtDate.getTime() + durationMs);
    const bookingDate = new Date(startsAtDate);
    bookingDate.setUTCHours(0, 0, 0, 0);

    // 5. Generate Upstream Payment Order via Gateway
    const gatewayOrder = await this.paymentGateway.createOrder({
      bookingId: "temp",
      amount: Number(providerService.price),
      currency: providerService.currency || "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    // 6. Execute Atomic Transaction: Booking + Payment + AuditLog
    try {
      return await this.prisma.$transaction(async (tx) => {
        // A. Insert Booking record
        const booking = await this.bookingRepository.create(
          {
            customerId,
            providerId: providerService.providerId,
            providerServiceId: providerService.id,
            bookingDate,
            startTime: startsAtDate,
            endTime: endsAtDate,
            bookingStatus: BookingStatus.PENDING_PAYMENT,
            bookedPrice: providerService.price,
            bookedDuration: providerService.durationMinutes,
            bookedServiceMode: providerService.service.serviceMode,
            serviceName: providerService.service.name,
            providerBusinessName: providerService.provider.businessName,
            customerNotes: dto.notes,
          },
          tx,
        );
        // B. Insert Initial Payment record
        const payment = await tx.payment.create({
          data: {
            bookingId: booking.id,
            gateway: PaymentGateway.RAZORPAY,
            gatewayOrderId: gatewayOrder.gatewayOrderId,
            amount: providerService.price,
            currency: providerService.currency || "INR",
            status: PaymentStatus.CREATED,
          },
        });
        // C. Insert Audit Log
        await tx.auditLog.create({
          data: {
            actorUserId: customerId,
            entityType: "Booking",
            entityId: booking.id,
            action: AuditAction.BOOKING_CREATED,
            newValue: {
              bookingStatus: booking.bookingStatus,
              startsAt: startsAtDate.toISOString(),
              endsAt: endsAtDate.toISOString(),
              price: Number(booking.bookedPrice),
              gatewayOrderId: gatewayOrder.gatewayOrderId,
            },
          },
        });
        this.logger.log(
          `Successfully created booking "${booking.id}" with payment order "${gatewayOrder.gatewayOrderId}"`,
        );
        // Return combined payload with Razorpay checkout details
        return {
          ...booking,
          payment: {
            id: payment.id,
            gateway: payment.gateway,
            orderId: payment.gatewayOrderId,
            amount: toSmallestCurrencyUnit(payment.amount, payment.currency), // in paise (e.g. 89999)
            currency: payment.currency,
            status: payment.status,
          },
        };
      });
    } catch (error: any) {
      if (
        error?.code === "P2002" ||
        error?.code === "P2010" ||
        error?.code === "P2034" ||
        error?.code === "P2039" ||
        error?.code === "23P01" ||
        error?.code === "40001" ||
        error?.message?.includes("no_provider_booking_overlap") ||
        error?.message?.includes("exclusion") ||
        error?.message?.includes("conflict") ||
        error?.message?.includes("write conflict") ||
        error?.message?.includes(
          "conflicting key value violates exclusion constraint",
        ) ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2002" ||
            error.code === "P2034" ||
            error.code === "P2039"))
      ) {
        this.logger.warn(
          `Booking conflict: provider ${providerService.providerId} is already booked for this interval`,
        );
        throw new ConflictException(
          "The selected time slot is no longer available. Please select another slot.",
        );
      }
      throw error;
    }
  }

  async getCustomerBookings(customerId: string, queryDto: QueryBookingsDto) {
    this.logger.log(`Fetching bookings for customer: ${customerId}`);
    return this.bookingRepository.findCustomerBooking(customerId, queryDto);
  }

  async getBookingById(bookingId: string, userId: string) {
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking) {
      throw new NotFoundException(`Booking with ID "${bookingId}" not found`);
    }

    // Authorize: Only booking customer or assigned provider can view details
    if (booking.customerId !== userId && booking.provider.userId !== userId) {
      throw new NotFoundException(`Booking with ID "${bookingId}" not found`);
    }

    return booking;
  }

  async cancelBookingAsCustomer(
    bookingId: string,
    customerId: string,
    dto: CancelBookingDto,
  ) {
    this.logger.log(
      `Customer ${customerId} requested cancellation for booking ${bookingId}`,
    );

    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking || booking.customerId !== customerId) {
      throw new NotFoundException(`Booking with ID "${bookingId}" not found`);
    }

    // 1. Verify Allowed State Transitions (PENDING_PAYMENT, CONFIRMED -> CANCELLED)
    if (!canTransitionBooking(booking.bookingStatus, BookingStatus.CANCELLED)) {
      throw new BadRequestException(
        `Cannot cancel booking in "${booking.bookingStatus}" status`,
      );
    }

    // 2. Enforce 2-Hour Cancellation Policy
    // Reconstruct start timestamp from bookingDate (Date) + startTime (Time)
    const appointmentStart = new Date(booking.bookingDate);
    appointmentStart.setUTCHours(
      booking.startTime.getUTCHours(),
      booking.startTime.getUTCMinutes(),
      booking.startTime.getUTCSeconds(),
      0,
    );

    const now = new Date();
    const cancellationDeadlineMs =
      appointmentStart.getTime() - 2 * 60 * 60 * 1000;

    if (now.getTime() >= cancellationDeadlineMs) {
      throw new ConflictException(
        "Bookings cannot be cancelled within 2 hours of the scheduled appointment time.",
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedBooking = await this.bookingRepository.updateStatus(
        bookingId,
        BookingStatus.CANCELLED,
        dto.reason || "Cancelled by customer",
        tx,
      );

      await tx.auditLog.create({
        data: {
          actorUserId: customerId,
          entityType: "Booking",
          entityId: bookingId,
          action: AuditAction.BOOKING_CANCELLED,
          oldValue: { status: booking.bookingStatus },
          newValue: {
            status: BookingStatus.CANCELLED,
            cancellationReason: dto.reason || "Cancelled by customer",
            cancelledAt: new Date().toISOString(),
          },
        },
      });

      this.logger.log(
        `Booking ${bookingId} cancelled by customer ${customerId}`,
      );
      return updatedBooking;
    });
  }
}

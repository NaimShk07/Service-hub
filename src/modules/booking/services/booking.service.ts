import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { BookingRepository } from "../repositories/booking.repository";
import { ProviderServiceRepository } from "@modules/provider/repositories/provider-service.repository";
import { CreateBookingDto } from "../dto/create-booking.dto";
import {
  BookingStatus,
  UserStatus,
  VerificationStatus,
} from "@prisma-client/enums";
import { canTransitionBooking } from "../domain/booking-state-machine";
import { ProviderAvailabilityRepository } from "@modules/provider/repositories/provider-availability.repositor";

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly providerServiceRepository: ProviderServiceRepository,
    private readonly providerAvailabilityRepository: ProviderAvailabilityRepository,
  ) {}

  async createBooking(customerId: string, dto: CreateBookingDto) {
    this.logger.log(`Creating booking request for customer: ${customerId}`);

    // 1. Fetch ProviderService offering with relations
    const providerService = await this.providerServiceRepository.findById(
      dto.providerServiceId,
    );

    if (!providerService || !providerService.isActive) {
      this.logger.warn(
        `Provider service offering "${dto.providerServiceId}" not found or inactive`,
      );
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

    // 2. Validate booking start date & 30-day advance window
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

    // 3. Validate Provider Working Hours & Buffer Occupation
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

    const fitsOccupiedInShift = daySchedules.some((shift) => {
      const [startH, startM] = shift.startTime.split(":").map(Number);
      const [endH, endM] = shift.endTime.split(":").map(Number);

      const shiftStart = startH * 60 + startM;
      const shiftEnd = endH * 60 + endM;

      return startMinutes >= shiftStart && occupiedEndMinutes <= shiftEnd;
    });

    if (!fitsOccupiedInShift) {
      throw new BadRequestException(
        "Requested booking slot (including post-service buffer) exceeds provider working shift hours",
      );
    }

    // 3. Compute endsAt time from server-defined durationMinutes
    const durationMs = providerService.durationMinutes * 60 * 1000;
    const endsAtDate = new Date(startsAtDate.getTime() + durationMs);

    // 4. Extract date portion for bookingDate
    const bookingDate = new Date(startsAtDate);
    bookingDate.setUTCHours(0, 0, 0, 0);

    // 5. Construct derived booking record
    const booking = await this.bookingRepository.create({
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
    });

    this.logger.log(`Successfully created booking "${booking.id}"`);
    return booking;
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

  async updateBookingStatus(
    bookingId: string,
    targetStatus: BookingStatus,
    reason?: string,
  ) {
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking) {
      throw new NotFoundException(`Booking with ID "${bookingId}" not found`);
    }

    if (!canTransitionBooking(booking.bookingStatus, targetStatus)) {
      throw new BadRequestException(
        `Cannot transition booking from state "${booking.bookingStatus}" to "${targetStatus}"`,
      );
    }

    return await this.bookingRepository.updateStatus(
      bookingId,
      targetStatus,
      reason,
    );
  }
}

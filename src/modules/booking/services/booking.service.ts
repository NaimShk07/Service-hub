import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { BookingRepository } from "../repositories/booking.repository";
import { ProviderServiceRepository } from "@modules/provider/repositories/provider-service.repository";
import { CreateBookingDto } from "../dto/create-booking.dto";
import { BookingStatus } from "@prisma-client/enums";
import { canTransitionBooking } from "../domain/booking-state-machine";

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly providerServiceRepository: ProviderServiceRepository,
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

    // 2. Validate start date is in the future
    const startsAtDate = new Date(dto.startsAt);
    if (isNaN(startsAtDate.getTime())) {
      throw new BadRequestException("Invalid date format for startsAt");
    }

    if (startsAtDate < new Date()) {
      throw new BadRequestException("Booking start time cannot be in the past");
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

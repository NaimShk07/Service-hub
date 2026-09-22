import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { BookingRepository } from "@modules/booking/repositories/booking.repository";
import { QueryBookingsDto } from "@modules/booking/dto/query-booking.dto";

@Injectable()
export class AdminBookingService {
  private readonly logger = new Logger(AdminBookingService.name);

  constructor(private readonly bookingRepository: BookingRepository) {}

  async findAll(queryDto: QueryBookingsDto) {
    return await this.bookingRepository.findAll(queryDto);
  }

  async findOne(id: string) {
    const booking = await this.bookingRepository.findById(id);

    if (!booking) {
      this.logger.warn(`Booking with ID "${id}" not found`);
      throw new NotFoundException(`Booking with ID "${id}" not found`);
    }

    return booking;
  }
}

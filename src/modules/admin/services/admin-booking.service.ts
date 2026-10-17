import { Injectable, Logger } from "@nestjs/common";
import { BookingService } from "@modules/booking/services/booking.service";
import { QueryAdminBookingDto } from "../dto/query-admin-booking.dto";

@Injectable()
export class AdminBookingService {
  private readonly logger = new Logger(AdminBookingService.name);

  constructor(private readonly bookingService: BookingService) {}

  async findAll(queryDto: QueryAdminBookingDto) {
    this.logger.log("Admin requesting platform-wide bookings");
    return await this.bookingService.getAllBookingsForAdmin(queryDto);
  }

  async findOne(id: string) {
    this.logger.log(`Admin investigating booking details for ID: ${id}`);
    return await this.bookingService.getBookingByIdForAdmin(id);
  }
}

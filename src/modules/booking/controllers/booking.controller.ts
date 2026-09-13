import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { BookingService } from "../services/booking.service";
import { CreateBookingDto } from "../dto/create-booking.dto";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { QueryBookingsDto } from "../dto/query-booking.dto";
import { CancelBookingDto } from "../dto/cancel-booking.dto";
import { Role } from "@prisma-client/enums";
import { Auth } from "@common/decorators/auth.decorator";

@ApiTags("Bookings")
@Controller("bookings")
@Auth()
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  /**
   * Create a new booking (starts in PENDING_PAYMENT status)
   */
  @Post()
  async createBooking(
    @CurrentUser("userId") customerId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingService.createBooking(customerId, dto);
  }

  /**
   * Get my bookings (with status/date filters and pagination)
   */
  @Get()
  async getMyBookings(
    @CurrentUser("userId") customerId: string,
    @Query() query: QueryBookingsDto,
  ) {
    return await this.bookingService.getCustomerBookings(customerId, query);
  }

  /**
   * Get booking details by ID
   */
  @Get(":id")
  async getBookingById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return await this.bookingService.getBookingById(id, userId);
  }

  /**
   * Cancel booking as customer (Subject to 2-hour policy)
   */
  @Patch(":id/cancel")
  async cancelBooking(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CancelBookingDto,
  ) {
    return await this.bookingService.cancelBookingAsCustomer(id, userId, dto);
  }

  /**
   * Mark booking as completed (by assigned provider or admin)
   */
  @Post(":id/complete")
  async completeBooking(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return await this.bookingService.completeBooking(
      id,
      user.userId,
      user.role,
    );
  }
}

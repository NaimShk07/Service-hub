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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { BookingService } from "../services/booking.service";
import { CreateBookingDto } from "../dto/create-booking.dto";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { QueryBookingsDto } from "../dto/query-booking.dto";
import { CancelBookingDto } from "../dto/cancel-booking.dto";
import { Role } from "@prisma-client/enums";
import { Auth } from "@common/decorators/auth.decorator";
import { Throttle } from "@nestjs/throttler";

@ApiTags("Bookings")
@ApiBearerAuth()
@Controller("bookings")
@Auth()
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  /**
   * Create a new booking (starts in PENDING_PAYMENT status)
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  @ApiOperation({ summary: "Create a new booking reservation" })
  @ApiResponse({
    status: 201,
    description: "Booking created in PENDING_PAYMENT status",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid booking request or interval",
  })
  @ApiResponse({
    status: 409,
    description: "Time slot conflict or provider unavailable",
  })
  @ApiResponse({ status: 429, description: "Rate limit exceeded" })
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

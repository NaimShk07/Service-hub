import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { BookingService } from "../services/booking.service";
import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { CreateBookingDto } from "../dto/create-booking.dto";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { QueryBookingsDto } from "../dto/query-booking.dto";
import { CancelBookingDto } from "../dto/cancel-booking.dto";

@ApiTags("Bookings")
@Controller("bookings")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new booking (starts in PENDING_PAYMENT status)",
  })
  @ApiResponse({ status: 201, description: "Booking created successfully" })
  @ApiResponse({
    status: 400,
    description: "Validation error or shift mismatch",
  })
  @ApiResponse({ status: 404, description: "Provider offering not found" })
  @ApiResponse({ status: 409, description: "Time slot is no longer available" })
  async createBooking(
    @CurrentUser("userId") customerId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingService.createBooking(customerId, dto);
  }

  @Get()
  @ApiOperation({
    summary: "Get my bookings (with status/date filters and pagination)",
  })
  @ApiResponse({ status: 200, description: "List of user bookings" })
  async getMyBookings(
    @CurrentUser("userId") customerId: string,
    @Query() query: QueryBookingsDto,
  ) {
    return await this.bookingService.getCustomerBookings(customerId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get booking details by ID" })
  @ApiResponse({ status: 200, description: "Booking details" })
  @ApiResponse({ status: 404, description: "Booking not found" })
  async getBookingById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return await this.bookingService.getBookingById(id, userId);
  }

  @Patch(":id/cancel")
  @ApiOperation({
    summary: "Cancel booking as customer (Subject to 2-hour policy)",
  })
  @ApiResponse({ status: 200, description: "Booking cancelled successfully" })
  @ApiResponse({ status: 400, description: "Invalid state transition" })
  @ApiResponse({ status: 404, description: "Booking not found" })
  @ApiResponse({
    status: 409,
    description: "Cannot cancel within 2 hours of appointment",
  })
  async cancelBooking(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CancelBookingDto,
  ) {
    return await this.bookingService.cancelBookingAsCustomer(id, userId, dto);
  }
}

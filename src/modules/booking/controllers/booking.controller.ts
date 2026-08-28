import { Body, Controller, Post, UseGuards } from "@nestjs/common";
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
  @ApiResponse({ status: 400, description: "Validation error or invalid time" })
  @ApiResponse({
    status: 404,
    description: "Provider service offering not found",
  })
  async createBooking(
    @CurrentUser("userId") customerId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingService.createBooking(customerId, dto);
  }
}

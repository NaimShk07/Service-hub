import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { BookingService } from "./booking.service";

@ApiTags("Bookings")
@Controller("bookings")
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}
}

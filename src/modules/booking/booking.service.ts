import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
}

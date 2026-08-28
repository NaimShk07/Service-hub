import { Module } from "@nestjs/common";
import { BookingService } from "./services/booking.service";
import { BookingController } from "./controllers/booking.controller";
import { ProviderModule } from "@modules/provider/provider.module";
import { BookingRepository } from "./repositories/booking.repository";

@Module({
  imports: [ProviderModule],
  controllers: [BookingController],
  providers: [BookingService, BookingRepository],
  exports: [BookingService, BookingRepository],
})
export class BookingModule {}

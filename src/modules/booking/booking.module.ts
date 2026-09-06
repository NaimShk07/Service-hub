import { forwardRef, Module } from "@nestjs/common";
import { BookingService } from "./services/booking.service";
import { BookingController } from "./controllers/booking.controller";
import { ProviderModule } from "@modules/provider/provider.module";
import { BookingRepository } from "./repositories/booking.repository";
import { PaymentModule } from "@modules/payment/payment.module";
import { JobsModule } from "@jobs/jobs.module";

@Module({
  imports: [ProviderModule, forwardRef(() => PaymentModule), JobsModule],
  controllers: [BookingController],
  providers: [BookingService, BookingRepository],
  exports: [BookingService, BookingRepository],
})
export class BookingModule {}

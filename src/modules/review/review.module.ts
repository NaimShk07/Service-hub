import { Module } from "@nestjs/common";
import { PrismaModule } from "@database/prisma/prisma.module";
import { BookingModule } from "@modules/booking/booking.module";
import { ReviewController } from "./controllers/review.controller";
import { ReviewService } from "./services/review.service";
import { ReviewRepository } from "./repositories/review.repository";

@Module({
  imports: [PrismaModule, BookingModule],
  controllers: [ReviewController],
  providers: [ReviewService, ReviewRepository],
  exports: [ReviewService, ReviewRepository],
})
export class ReviewModule {}

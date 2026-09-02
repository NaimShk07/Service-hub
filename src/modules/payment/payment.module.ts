import { forwardRef, Module } from "@nestjs/common";
import { PaymentService } from "./services/payment.service";
import { PaymentRepository } from "./repositories/payment.repository";
import { BookingModule } from "@modules/booking/booking.module";
import { PaymentController } from "./controllers/payment.controller";
import { PAYMENT_GATEWAY } from "./gateway/payment-gateway.token";
import { RazorpayGateway } from "./gateway/razor.gateway";

@Module({
  imports: [forwardRef(() => BookingModule)],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentRepository,
    {
      provide: PAYMENT_GATEWAY,
      useClass: RazorpayGateway,
    },
  ],
  exports: [PaymentService, PaymentRepository, PAYMENT_GATEWAY],
})
export class PaymentModule {}

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PaymentRepository } from "../repositories/payment.repository";
import { BookingRepository } from "@modules/booking/repositories/booking.repository";
import { IPaymentGateway } from "../gateway/payment-gateway.interface";
import { PAYMENT_GATEWAY } from "../gateway/payment-gateway.token";
import { PrismaService } from "@database/prisma/prisma.service";
import { CreatePaymentOrderDto } from "../dto/create-payment-order.dto";
import {
  BookingStatus,
  PaymentGateway,
  PaymentStatus,
} from "@prisma-client/enums";

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly bookingRepository: BookingRepository,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: IPaymentGateway,
    private readonly prisma: PrismaService,
  ) {}

  async createPaymentOrder(customerId: string, dto: CreatePaymentOrderDto) {
    this.logger.log(`Creating payment order for booking: ${dto.bookingId}`);

    // 1. Fetch Booking and verify ownership & status
    const booking = await this.bookingRepository.findById(dto.bookingId);
    if (!booking) {
      throw new NotFoundException(
        `Booking with ID "${dto.bookingId}" not found`,
      );
    }

    if (booking.customerId !== customerId) {
      throw new ForbiddenException(
        "You are not authorized to pay for this booking",
      );
    }

    if (booking.bookingStatus !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Cannot create payment order for booking in status "${booking.bookingStatus}"`,
      );
    }

    // 2. Check if an active created payment record already exists
    const existingPayment = await this.paymentRepository.findByBookingId(
      booking.id,
    );
    if (existingPayment && existingPayment.status === PaymentStatus.CREATED) {
      return existingPayment;
    }

    // 3. Create Gateway Order through decoupled IPaymentGateway
    const gatewayOrder = await this.paymentGateway.createOrder({
      bookingId: booking.id,
      amount: Number(booking.bookedPrice),
      currency: "INR",
      receipt: `rcpt_${booking.id.slice(0, 8)}`,
    });

    // 4. Save Payment Record to PostgreSQL
    const payment = await this.paymentRepository.create({
      bookingId: booking.id,
      gateway: PaymentGateway.RAZORPAY,
      gatewayOrderId: gatewayOrder.gatewayOrderId,
      amount: booking.bookedPrice,
      currency: gatewayOrder.currency,
      status: PaymentStatus.CREATED,
    });

    this.logger.log(
      `Created payment record "${payment.id}" with gatewayOrderId "${gatewayOrder.gatewayOrderId}"`,
    );
    return payment;
  }

  async getPaymentById(paymentId: string, userId: string) {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundException(`Payment with ID "${paymentId}" not found`);
    }
    if (
      payment.booking.customerId !== userId &&
      payment.booking.provider.userId !== userId
    ) {
      throw new NotFoundException(`Payment with ID "${paymentId}" not found`);
    }
    return payment;
  }
}

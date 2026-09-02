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
  AuditAction,
  BookingStatus,
  PaymentGateway,
  PaymentStatus,
} from "@prisma-client/enums";
import { VerifyPaymentDto } from "../dto/verify-payment.dto";
import { canTransitionPayment } from "../domain/payment-state-machine";

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

  async verifyClientPayment(customerId: string, dto: VerifyPaymentDto) {
    this.logger.log(
      `Verifying payment signature for order: ${dto.razorpayOrderId}`,
    );

    // 1. Fetch Payment Record with associated Booking
    const payment = await this.paymentRepository.findByGatewayOrderId(
      dto.razorpayOrderId,
    );

    if (!payment) {
      throw new NotFoundException(
        `Payment record for order "${dto.razorpayOrderId}" not found`,
      );
    }

    if (payment.booking.customerId !== customerId) {
      throw new ForbiddenException(
        "You are not authorized to verify this payment",
      );
    }

    // 2. Cryptographic Signature Verification
    const isValidSignature = this.paymentGateway.verifyPaymentSignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );

    if (!isValidSignature) {
      this.logger.warn(
        `Invalid signature received for order "${dto.razorpayOrderId}"`,
      );
      throw new BadRequestException("Invalid payment signature");
    }

    // 3. Idempotent Check: If already confirmed/success (e.g. webhook executed earlier)
    if (
      payment.status === PaymentStatus.SUCCESS &&
      payment.booking.bookingStatus === BookingStatus.CONFIRMED
    ) {
      this.logger.log(
        `Payment "${payment.id}" already in SUCCESS state (idempotent verification)`,
      );
      return {
        success: true,
        message: "Payment already verified",
        bookingId: payment.bookingId,
        bookingStatus: payment.booking.bookingStatus,
        paymentStatus: payment.status,
      };
    }

    // 4. Validate State Transitions
    if (!canTransitionPayment(payment.status, PaymentStatus.SUCCESS)) {
      throw new BadRequestException(
        `Cannot transition payment from "${payment.status}" to "${PaymentStatus.SUCCESS}"`,
      );
    }

    // 5. Execute Atomic Transition in $transaction
    return this.prisma.$transaction(async (tx) => {
      // Update Payment to SUCCESS
      const updatedPayment = await this.paymentRepository.updateStatus(
        payment.id,
        PaymentStatus.SUCCESS,
        {
          gatewayPaymentId: dto.razorpayPaymentId,
          gatewaySignature: dto.razorpaySignature,
          paidAt: new Date(),
        },
        tx,
      );

      // Update Booking to CONFIRMED
      const updatedBooking = await this.bookingRepository.updateStatus(
        payment.bookingId,
        BookingStatus.CONFIRMED,
        undefined,
        tx,
      );

      // Audit Logs
      await tx.auditLog.create({
        data: {
          actorUserId: customerId,
          entityType: "Payment",
          entityId: payment.id,
          action: AuditAction.PAYMENT_SUCCESS,
          oldValue: { status: payment.status },
          newValue: {
            status: PaymentStatus.SUCCESS,
            gatewayPaymentId: dto.razorpayPaymentId,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: customerId,
          entityType: "Booking",
          entityId: payment.bookingId,
          action: AuditAction.BOOKING_CONFIRMED,
          oldValue: { status: payment.booking.bookingStatus },
          newValue: { status: BookingStatus.CONFIRMED },
        },
      });
      this.logger.log(
        `Payment "${payment.id}" verified -> Booking "${payment.bookingId}" is CONFIRMED`,
      );

      return {
        success: true,
        message: "Payment verified successfully",
        bookingId: updatedBooking.id,
        bookingStatus: updatedBooking.bookingStatus,
        paymentStatus: updatedPayment.status,
        paidAt: updatedPayment.paidAt,
      };
    });
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

  async handleWebhookEvent(rawBody: Buffer, signature: string) {
    this.logger.log("Received incoming Razorpay webhook");

    if (!rawBody || !signature) {
      throw new BadRequestException("Missing webhook payload or signature");
    }

    // 1. Verify Cryptographic Signature against Raw Buffer
    const isValid = this.paymentGateway.verifyWebhookSignature(
      rawBody,
      signature,
      undefined,
    );

    if (!isValid) {
      this.logger.warn("Razorpay webhook signature verification failed");
      throw new BadRequestException("Invalid webhook signature");
    }

    // 2. Safely Parse Payload
    let eventPayload: any;
    try {
      eventPayload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new BadRequestException("Malformed JSON in webhook body");
    }

    const eventName = eventPayload.event;
    this.logger.log(`Processing Razorpay webhook event: "${eventName}"`);

    // 3. Extract Order & Payment Identifiers
    const paymentEntity = eventPayload.payload?.payment?.entity;
    const orderEntity = eventPayload.payload?.order?.entity;

    const gatewayOrderId = paymentEntity?.order_id || orderEntity?.id;
    const gatewayPaymentId = paymentEntity?.id;

    if (!gatewayOrderId) {
      this.logger.log(
        `Event "${eventName}" does not contain a gateway order ID. Skipping.`,
      );
      return { received: true, ignored: true };
    }

    // 4. Fetch Matching Payment & Booking Record
    const payment =
      await this.paymentRepository.findByGatewayOrderId(gatewayOrderId);
    if (!payment) {
      this.logger.warn(
        `No payment record found for order "${gatewayOrderId}". Skipping.`,
      );
      return { received: true, ignored: true };
    }

    // 5. Handle Event Types
    switch (eventName) {
      case "payment.captured":
      case "order.paid": {
        // Idempotency: If already confirmed, do not repeat writes
        if (
          payment.status === PaymentStatus.SUCCESS &&
          payment.booking.bookingStatus === BookingStatus.CONFIRMED
        ) {
          this.logger.log(
            `Order "${gatewayOrderId}" already marked SUCCESS. Idempotent skip.`,
          );
          return { received: true, status: "already_processed" };
        }

        if (!canTransitionPayment(payment.status, PaymentStatus.SUCCESS)) {
          this.logger.warn(
            `Cannot transition payment ${payment.id} from ${payment.status} to SUCCESS`,
          );
          return { received: true, ignored: true };
        }

        return await this.prisma.$transaction(async (tx) => {
          await this.paymentRepository.updateStatus(
            payment.id,
            PaymentStatus.SUCCESS,
            {
              gatewayPaymentId: gatewayPaymentId || payment.gatewayPaymentId,
              paidAt: new Date(),
            },
            tx,
          );

          await this.bookingRepository.updateStatus(
            payment.bookingId,
            BookingStatus.CONFIRMED,
            undefined,
            tx,
          );

          await tx.auditLog.create({
            data: {
              actorUserId: payment.booking.customerId,
              entityType: "Payment",
              entityId: payment.id,
              action: AuditAction.PAYMENT_SUCCESS,
              oldValue: { status: payment.status },
              newValue: { status: PaymentStatus.SUCCESS, event: eventName },
            },
          });
          await tx.auditLog.create({
            data: {
              actorUserId: payment.booking.customerId,
              entityType: "Booking",
              entityId: payment.bookingId,
              action: AuditAction.BOOKING_CONFIRMED,
              oldValue: { status: payment.booking.bookingStatus },
              newValue: { status: BookingStatus.CONFIRMED, source: "webhook" },
            },
          });
          this.logger.log(
            `Webhook confirmed Booking "${payment.bookingId}" via Payment "${payment.id}"`,
          );
          return { received: true, status: "confirmed" };
        });
      }
      case "payment.failed": {
        if (payment.status === PaymentStatus.FAILED) {
          return { received: true, status: "already_failed" };
        }

        return await this.prisma.$transaction(async (tx) => {
          await this.paymentRepository.updateStatus(
            payment.id,
            PaymentStatus.FAILED,
            { gatewayPaymentId },
            tx,
          );
          await this.bookingRepository.updateStatus(
            payment.bookingId,
            BookingStatus.PAYMENT_FAILED,
            paymentEntity?.error_description || "Payment failed via gateway",
            tx,
          );
          await tx.auditLog.create({
            data: {
              actorUserId: payment.booking.customerId,
              entityType: "Payment",
              entityId: payment.id,
              action: AuditAction.PAYMENT_FAILED,
              newValue: {
                status: PaymentStatus.FAILED,
                error: paymentEntity?.error_description,
              },
            },
          });
          return { received: true, status: "failed" };
        });
      }
      default:
        this.logger.log(
          `Unhandled webhook event type: "${eventName}". Returning 200.`,
        );
        return { received: true, ignored: true };
    }
  }
}

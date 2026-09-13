import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PaymentService } from "../services/payment.service";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { CreatePaymentOrderDto } from "../dto/create-payment-order.dto";
import { VerifyPaymentDto } from "../dto/verify-payment.dto";
import { Request } from "express";
import { RefundPaymentDto } from "../dto/refund-payment.dto";
import { Auth } from "@common/decorators/auth.decorator";
import { Role } from "@prisma-client/enums";

@ApiTags("Payments")
@Controller("payments")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create a Razorpay payment order for a booking
   */
  @Post("orders")
  @Auth()
  async createPaymentOrder(
    @CurrentUser("userId") customerId: string,
    @Body() dto: CreatePaymentOrderDto,
  ) {
    return await this.paymentService.createPaymentOrder(customerId, dto);
  }

  /**
   * Verify client-side Razorpay payment signature
   */
  @Post("verify")
  @Auth()
  async verifyPayment(
    @CurrentUser("userId") customerId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return await this.paymentService.verifyClientPayment(customerId, dto);
  }

  /**
   * Public webhook endpoint for Razorpay server events (No JWT)
   */
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async handleRazorpayWebhook(
    @Req() req: Request,
    @Headers("x-razorpay-signature") signature: string,
    @Headers("x-razorpay-event-id") eventId?: string,
  ) {
    const rawBody = (req as any).rawBody;

    if (!rawBody) {
      throw new BadRequestException(
        "Raw body buffer not found. Ensure rawBody: true is enabled.",
      );
    }

    return await this.paymentService.handleWebhookEvent(
      rawBody,
      signature,
      eventId,
    );
  }

  /**
   * Get payment details by ID
   */
  @Get(":id")
  @Auth()
  async getPaymentById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return await this.paymentService.getPaymentById(id, userId);
  }

  /**
   * Refund a successful payment (Admin only)
   */
  @Post(":id/refund")
  @Auth(Role.ADMIN)
  async refundPayment(
    @CurrentUser("userId") adminUserId: string,
    @Param("id", ParseUUIDPipe) paymentId: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return await this.paymentService.refundPayment(adminUserId, paymentId, dto);
  }
}

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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { PaymentService } from "../services/payment.service";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { CreatePaymentOrderDto } from "../dto/create-payment-order.dto";
import { VerifyPaymentDto } from "../dto/verify-payment.dto";
import { Request } from "express";
import { RefundPaymentDto } from "../dto/refund-payment.dto";
import { Auth } from "@common/decorators/auth.decorator";
import { Role } from "@prisma-client/enums";
import { SkipThrottle, Throttle } from "@nestjs/throttler";

@ApiTags("Payments")
@Controller("payments")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create a Razorpay payment order for a booking
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("orders")
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create Razorpay order for booking reservation" })
  @ApiResponse({
    status: 201,
    description: "Razorpay order created successfully",
  })
  @ApiResponse({ status: 400, description: "Booking not eligible or expired" })
  @ApiResponse({ status: 429, description: "Rate limit exceeded" })
  async createPaymentOrder(
    @CurrentUser("userId") customerId: string,
    @Body() dto: CreatePaymentOrderDto,
  ) {
    return await this.paymentService.createPaymentOrder(customerId, dto);
  }

  /**
   * Verify client-side Razorpay payment signature
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("verify")
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Verify Razorpay payment signature from client" })
  @ApiResponse({
    status: 200,
    description: "Payment verified and booking confirmed",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid signature or payment tampering",
  })
  @ApiResponse({ status: 429, description: "Rate limit exceeded" })
  async verifyPayment(
    @CurrentUser("userId") customerId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return await this.paymentService.verifyClientPayment(customerId, dto);
  }

  /**
   * Public webhook endpoint for Razorpay server events (No JWT)
   */
  @SkipThrottle()
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Webhook handler for Razorpay server-to-server notifications",
  })
  @ApiResponse({
    status: 200,
    description: "Webhook event processed idempotently",
  })
  @ApiResponse({ status: 400, description: "Invalid webhook signature" })
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

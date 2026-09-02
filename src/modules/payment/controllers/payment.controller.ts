import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { PaymentService } from "../services/payment.service";
import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { CreatePaymentOrderDto } from "../dto/create-payment-order.dto";
import { VerifyPaymentDto } from "../dto/verify-payment.dto";
import { Request } from "express";

@ApiTags("Payments")
@Controller("payments")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post("orders")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a Razorpay payment order for a booking" })
  @ApiResponse({
    status: 201,
    description: "Payment order created successfully",
  })
  async createPaymentOrder(
    @CurrentUser("userId") customerId: string,
    @Body() dto: CreatePaymentOrderDto,
  ) {
    return await this.paymentService.createPaymentOrder(customerId, dto);
  }

  @Post("verify")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Verify client-side Razorpay payment signature" })
  @ApiResponse({
    status: 200,
    description: "Payment verified and booking confirmed",
  })
  async verifyPayment(
    @CurrentUser("userId") customerId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return await this.paymentService.verifyClientPayment(customerId, dto);
  }

  @Post("webhook")
  @ApiOperation({
    summary: "Public webhook endpoint for Razorpay server events (No JWT)",
  })
  @ApiResponse({ status: 200, description: "Webhook event processed" })
  @ApiResponse({ status: 400, description: "Invalid webhook signature" })
  async handleRazorpayWebhook(
    @Req() req: Request,
    @Headers("x-razorpay-signature") signature: string,
  ) {
    // req.rawBody is populated by NestFactory.create(AppModule, { rawBody: true })
    const rawBody = (req as any).rawBody;

    if (!rawBody) {
      throw new BadRequestException(
        "Raw body buffer not found. Ensure rawBody: true is enabled.",
      );
    }

    return await this.paymentService.handleWebhookEvent(rawBody, signature);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get payment details by ID" })
  @ApiResponse({ status: 200, description: "Payment details" })
  async getPaymentById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return await this.paymentService.getPaymentById(id, userId);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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

@ApiTags("Payments")
@Controller("payments")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post("orders")
  @ApiOperation({ summary: "Create a Razorpay payment order for a booking" })
  @ApiResponse({
    status: 201,
    description: "Payment order created successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid booking status" })
  @ApiResponse({ status: 404, description: "Booking not found" })
  async createPaymentOrder(
    @CurrentUser("userId") customerId: string,
    @Body() dto: CreatePaymentOrderDto,
  ) {
    return await this.paymentService.createPaymentOrder(customerId, dto);
  }

  @Post("verify")
  @ApiOperation({ summary: "Verify client-side Razorpay payment signature" })
  @ApiResponse({
    status: 200,
    description: "Payment verified and booking confirmed",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid signature or state transition",
  })
  @ApiResponse({ status: 404, description: "Payment order not found" })
  async verifyPayment(
    @CurrentUser("userId") customerId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return await this.paymentService.verifyClientPayment(customerId, dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get payment details by ID" })
  @ApiResponse({ status: 200, description: "Payment details" })
  @ApiResponse({ status: 404, description: "Payment not found" })
  async getPaymentById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return await this.paymentService.getPaymentById(id, userId);
  }
}

import { Injectable, Logger } from "@nestjs/common";
import {
  CreateGatewayOrderParams,
  GatewayOrderResult,
  IPaymentGateway,
} from "./payment-gateway.interface";
import { ConfigService } from "@nestjs/config";
import crypto from "crypto";

@Injectable()
export class RazorpayGateway implements IPaymentGateway {
  private readonly logger = new Logger(RazorpayGateway.name);
  private readonly keyId: string;
  private readonly keySecret: string;

  constructor(private readonly configService: ConfigService) {
    this.keyId =
      this.configService.get<string>("RAZORPAY_KEY_ID") || "rzp_test_mock_id";
    this.keySecret =
      this.configService.get<string>("RAZORPAY_KEY_SECRET") ||
      "rzp_test_mock_secret";
  }

  async createOrder(
    params: CreateGatewayOrderParams,
  ): Promise<GatewayOrderResult> {
    this.logger.log(
      `Creating Razorpay Order for booking: ${params.bookingId}, amount: ${params.amount} ${params.currency}`,
    );

    // Convert amount to smallest currency unit (INR Rupees -> Paise: * 100)
    const amountInPaise = Math.round(params.amount * 100);

    // Mock / Stub order generation (can be swapped with official SDK: new Razorpay().orders.create)
    const mockGatewayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
    return {
      gatewayOrderId: mockGatewayOrderId,
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt,
      rawPayload: {
        id: mockGatewayOrderId,
        amount: amountInPaise,
        currency: params.currency,
      },
    };
  }
  verifyWebhookSignature(
    rawBody: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", secret || this.keySecret)
      .update(rawBody)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  }
}

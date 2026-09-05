import { Injectable, Logger } from "@nestjs/common";
import {
  CreateGatewayOrderParams,
  CreateRefundParams,
  GatewayOrderResult,
  GatewayRefundResult,
  IPaymentGateway,
} from "./payment-gateway.interface";
import { ConfigService } from "@nestjs/config";
import crypto from "crypto";
import { toSmallestCurrencyUnit } from "@common/utils/currency.util";

@Injectable()
export class RazorpayGateway implements IPaymentGateway {
  private readonly logger = new Logger(RazorpayGateway.name);
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.keyId =
      this.configService.get<string>("RAZORPAY_KEY_ID") || "rzp_test_mock_id";
    this.keySecret =
      this.configService.get<string>("RAZORPAY_KEY_SECRET") ||
      "rzp_test_mock_secret";
    this.webhookSecret =
      this.configService.get<string>("RAZORPAY_WEBHOOK_SECRET") ||
      "rzp_test_webhook_secret";
  }

  async createOrder(
    params: CreateGatewayOrderParams,
  ): Promise<GatewayOrderResult> {
    this.logger.log(
      `Creating Razorpay Order for booking: ${params.bookingId}, amount: ${params.amount} ${params.currency}`,
    );

    // Centralized conversion: ₹899.99 -> 89999 paise
    const amountInPaise = toSmallestCurrencyUnit(
      params.amount,
      params.currency,
    );

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

  async createRefund(params: CreateRefundParams): Promise<GatewayRefundResult> {
    this.logger.log(
      `Initiating Razorpay Refund for payment: ${params.paymentId}`,
    );
    const mockRefundId = `rfnd_${crypto.randomBytes(8).toString("hex")}`;

    return {
      refundId: mockRefundId,
      amount: params.amount || 0,
      status: "processed",
      rawPayload: {
        id: mockRefundId,
        payment_id: params.paymentId,
        status: "processed",
      },
    };
  }

  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
    secret?: string,
  ): boolean {
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret || this.keySecret)
      .update(text)
      .digest("hex");

    if (Buffer.byteLength(expectedSignature) !== Buffer.byteLength(signature)) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  }

  verifyWebhookSignature(
    rawBody: string | Buffer,
    signature: string,
    secret?: string,
  ): boolean {
    const webhookSecret = secret || this.webhookSecret;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (Buffer.byteLength(expectedSignature) !== Buffer.byteLength(signature)) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  }
}

export interface CreateGatewayOrderParams {
  bookingId: string;
  amount: number; // in standard currency units (e.g. INR 750.00)
  currency: string; // e.g. "INR"
  receipt: string;
  notes?: Record<string, string>;
}

export interface GatewayOrderResult {
  gatewayOrderId: string;
  amount: number;
  currency: string;
  receipt: string;
  rawPayload?: any;
}

export interface IPaymentGateway {
  /**
   * Creates an upstream order with the payment provider
   */
  createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult>;

  /**
   * Verifies the client checkout signature: HMAC_SHA256(order_id + "|" + payment_id, secret)
   */
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
    secret?: string,
  ): boolean;

  /**
   * Verifies the cryptographic HMAC SHA-256 signature of an incoming webhook
   */
  verifyWebhookSignature(
    rawBody: string | Buffer,
    signature: string,
    secret: string,
  ): boolean;
}

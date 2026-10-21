export interface ExpirePaymentJobPayload {
  bookingId: string;
  expectedPaymentExpiresAt: string; // ISO string for invariant validation
  requestId?: string;
}

export interface ProcessNoShowJobPayload {
  bookingId: string;
  requestId?: string;
}

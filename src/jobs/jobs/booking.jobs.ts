export interface ExpirePaymentJobPayload {
  bookingId: string;
  expectedPaymentExpiresAt: string; // ISO string for invariant validation
}

export interface ProcessNoShowJobPayload {
  bookingId: string;
}

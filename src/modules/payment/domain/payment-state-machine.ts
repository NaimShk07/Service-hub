import { PaymentStatus } from "@prisma-client/enums";

export const VALID_PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> =
  {
    [PaymentStatus.CREATED]: [
      PaymentStatus.PENDING,
      PaymentStatus.SUCCESS,
      PaymentStatus.FAILED,
    ],
    [PaymentStatus.PENDING]: [PaymentStatus.SUCCESS, PaymentStatus.FAILED],
    [PaymentStatus.SUCCESS]: [PaymentStatus.REFUNDED],
    [PaymentStatus.FAILED]: [],
    [PaymentStatus.REFUNDED]: [],
  };

/**
 * Validates whether a state transition from `current` to `next` is allowed.
 * Returns true if valid or if it's an idempotent transition (current === next).
 * Same state ko same state mein rakhna — repeat karne se kuch change nahi hoga.
 */
export function canTransitionPayment(
  current: PaymentStatus,
  next: PaymentStatus,
): boolean {
  if (current === next) return true; // Idempotent no-op
  return VALID_PAYMENT_TRANSITIONS[current]?.includes(next) ?? false;
}

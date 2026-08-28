import { BookingStatus } from "@prisma-client/enums";

export const VALID_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> =
  {
    [BookingStatus.PENDING_PAYMENT]: [
      BookingStatus.CONFIRMED,
      BookingStatus.PAYMENT_FAILED,
      BookingStatus.CANCELLED,
      BookingStatus.EXPIRED,
    ],
    [BookingStatus.CONFIRMED]: [
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
    ],
    [BookingStatus.PAYMENT_FAILED]: [
      BookingStatus.PENDING_PAYMENT,
      BookingStatus.EXPIRED,
    ],
    [BookingStatus.COMPLETED]: [],
    [BookingStatus.CANCELLED]: [],
    [BookingStatus.EXPIRED]: [],
  };

export function canTransitionBooking(
  current: BookingStatus,
  next: BookingStatus,
): boolean {
  return VALID_BOOKING_TRANSITIONS[current]?.includes(next) ?? false;
}

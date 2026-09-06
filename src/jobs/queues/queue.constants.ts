export const QUEUE_NOTIFICATION = "notification";
export const QUEUE_BOOKING = "booking";

export const NOTIFICATION_JOBS = {
  BOOKING_CONFIRMATION: "booking.confirmation",
  REMINDER_24H: "reminder.24h",
  REMINDER_2H: "reminder.2h",
  REVIEW_REQUEST: "review.request",
} as const;

export const BOOKING_JOBS = {
  EXPIRE_PAYMENT: "booking.expire-payment",
  PROCESS_NO_SHOW: "booking.process-no-show",
} as const;

export const DEFAULT_RETRY_POLICY = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000, // 2s -> 4s -> 8s
  },
} as const;

export const DEFAULT_JOB_REMOVAL_POLICY = {
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs in Redis for quick inspection
    age: 3600, // Remove completed jobs older than 1 hour to save Redis memory
  },
  removeOnFail: {
    count: 1000, // Keep up to 1000 failed jobs for debugging
    age: 86400 * 7, // Retain failed jobs for 7 days
  },
} as const;

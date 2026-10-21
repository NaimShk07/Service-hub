# Day 4: Background Jobs & Webhook Reliability Guide

## 1. Overview & Architecture

In distributed architectures, background workers and webhook consumers must be designed for **at-least-once delivery** and **unreliable networks**. Transient errors (SMTP timeouts, network partitions, webhook replays) must never corrupt financial truth or send duplicate notifications.

ServiceHub enforces a three-tier reliability strategy:
1. **Dual-Persistence:** Persist business records in PostgreSQL *before* queue dispatch.
2. **Deterministic Deduplication:** Idempotent job IDs and state-machine preconditions.
3. **Exponential Backoff & Observable Dead-Letter State:** Structured retries with persistent failure tracking.

---

## 2. Retry Policies & Failure Lifecycle

### Configured Retry Policy (`src/jobs/queues/queue.constants.ts`)

```typescript
export const DEFAULT_RETRY_POLICY = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000, // Attempt 1: 5s, Attempt 2: 10s, Attempt 3: 20s
  },
} as const;
```

### Job Retention Policy

```typescript
export const DEFAULT_JOB_REMOVAL_POLICY = {
  removeOnComplete: {
    count: 100, // Retain last 100 completed jobs in Redis for inspection
    age: 3600,  // Expire after 1 hour to prevent Redis memory bloat
  },
  removeOnFail: {
    count: 1000,     // Retain up to 1000 failed jobs for debugging
    age: 86400 * 7,  // Keep failed jobs for 7 days
  },
} as const;
```

### Failure Handling & Permanent Failure Hook

When a transient failure occurs (e.g. SMTP connection timeout):
1. `NotificationProcessor.process(job)` captures the exception, increments `attemptCount` in PostgreSQL, and re-throws the error to notify BullMQ.
2. BullMQ pauses and schedules an exponential retry.
3. If all 3 attempts are exhausted, the `@OnWorkerEvent('failed')` / `onFailed` hook executes:
   - Updates PostgreSQL `notifications` record: `status = FAILED`, `failedAt = new Date()`, `failureReason = error.message`.
   - Logs an observable alert with job ID, attempt count, and recipient user ID.

---

## 3. Idempotency & Deduplication Strategies

### 1. Deterministic Job IDs
To prevent duplicate queue submissions from creating multiple notification jobs in Redis, ServiceHub generates deterministic IDs:
- Booking Confirmation: `booking-confirm_${bookingId}`
- 24-Hour Reminder: `reminder-24h_${bookingId}`
- 2-Hour Reminder: `reminder-2h_${bookingId}`
- Review Request: `review-request_${bookingId}`

If the same notification is scheduled repeatedly, BullMQ matches the `jobId` and skips redundant additions.

### 2. Processor-Level Idempotency Guard
BullMQ retries provide transient resilience, but workers can restart mid-flight. When a job runs:
```typescript
if (notification && notification.status === NotificationStatus.SENT) {
  this.logger.warn(`Notification [${notification.id}] already SENT. Skipping.`);
  return { delivered: true, alreadyProcessed: true };
}
```
If a worker crashed after sending an email but before acknowledging BullMQ, the subsequent execution will see `status === SENT` and safely no-op without double-emailing.

### 3. Webhook Idempotency & Global Lock Ordering
- **Signature Verification:** Rejects unauthenticated webhooks with HMAC SHA256 (`400 Bad Request`).
- **Event Deduplication:** Stores and checks processed Razorpay event IDs; duplicates return `200 OK` with `{ status: "already_processed" }`.
- **Global Lock Order (`bookings` then `payments`):** Eliminates database deadlocks between concurrent webhook payments and background reservation expiry workers.

---

## 4. Cancellation & Expiration Suppression

When a booking is cancelled or expires:
1. **Queue Cleanup:** `cancelBookingReminders(bookingId)` removes pending delayed reminder jobs from the BullMQ queue (`job.remove()`) and deletes pending notification records from PostgreSQL.
2. **Processor Pre-Condition Check:** If a delayed reminder job executes while a booking was cancelled or expired, `NotificationProcessor` evaluates:
```typescript
if (booking && (booking.bookingStatus === BookingStatus.CANCELLED || booking.bookingStatus === BookingStatus.EXPIRED)) {
  this.logger.log(`Booking "${bookingId}" is ${booking.bookingStatus}. Skipping reminder.`);
  await this.prisma.notification.delete({ where: { id: notification.id } });
  return { delivered: false, reason: `booking_${booking.bookingStatus.toLowerCase()}` };
}
```
No email is sent, and the stale pending record is cleaned up.

---

## 5. Outage Recovery & Worker Crash Safety

| Failure Scenario | Recovery Mechanism |
| :--- | :--- |
| **Worker node crashes mid-execution** | BullMQ's stalled job checker (`stalledInterval: 30000`) detects unrenewed locks and moves stalled jobs back to `wait` for available workers. |
| **Redis temporary outage** | Notification records are persisted in PostgreSQL (`status: PENDING`, `scheduledFor`) prior to Redis enqueueing. Offline reconciler can query pending un-sent records. |
| **Email provider outage (SendGrid/Resend/SMTP)** | Exponential backoff retries 3 times across a 35s window. If outage exceeds retry window, record is marked `FAILED` with exact error message in PostgreSQL for manual retry / dead-letter inspection. |
| **Tampered webhook arrival** | Webhook handler logs `🚨 TAMPERING DETECTED`, breaks execution without updating booking or payment records, preventing fraudulent confirmations. |

---

## 6. Automated Test Matrix (`test/bullmq-jobs.e2e-spec.ts`)

- `✓ Email success transitions notification status to SENT`
- `✓ Email failure re-throws to trigger BullMQ retry and increments attemptCount`
- `✓ Permanent failure hook marks notification as FAILED on retry exhaustion`
- `✓ Reminder for an EXPIRED booking is suppressed without delivering email`
- `✓ Duplicate queue submissions with same deterministic jobId do not send duplicate notifications`
- `✓ Already SENT notification is idempotently skipped if re-processed (Worker restart / duplicate delivery)`
- `✓ Overdue job safely flags CONFIRMED booking for review (needsReview=true, overdueAt set)`
- `✓ Two concurrent workers expiring the same booking safely transition exactly once`

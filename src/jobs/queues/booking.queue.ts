import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  BOOKING_JOBS,
  DEFAULT_JOB_REMOVAL_POLICY,
  DEFAULT_RETRY_POLICY,
  QUEUE_BOOKING,
} from "./queue.constants";
import { ExpirePaymentJobPayload } from "../jobs/booking.jobs";

@Injectable()
export class BookingQueueService {
  private readonly logger = new Logger(BookingQueueService.name);

  constructor(
    @InjectQueue(QUEUE_BOOKING)
    private readonly bookingQueue: Queue<ExpirePaymentJobPayload>,
  ) {}

  /**
   * Schedules a delayed job to expire a reservation if payment is not received in time (e.g. 15 mins).
   */
  async schedulePaymentExpiration(bookingId: string, delayMs: number) {
    const jobId = `expire-payment_${bookingId}`;
    this.logger.log(
      `Scheduling payment expiration for booking ${bookingId} in ${delayMs / 1000}s [jobId: ${jobId}]`,
    );

    return await this.bookingQueue.add(
      BOOKING_JOBS.EXPIRE_PAYMENT,
      {
        bookingId,
        expectedPaymentExpiresAt: new Date(Date.now() + delayMs).toISOString(),
      },
      {
        jobId, // Enforces exact-once scheduling per booking!
        delay: delayMs,
        ...DEFAULT_RETRY_POLICY,
        ...DEFAULT_JOB_REMOVAL_POLICY,
      },
    );
  }

  /**
   * If payment succeeds before the timeout, cancel the pending expiration job!
   */
  async cancelPaymentExpiration(bookingId: string) {
    const jobId = `expire-payment_${bookingId}`;
    const job = await this.bookingQueue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Cancelled payment expiration job "${jobId}"`);
      return true;
    }
    return false;
  }
}

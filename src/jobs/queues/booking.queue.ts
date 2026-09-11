import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  BOOKING_JOBS,
  DEFAULT_JOB_REMOVAL_POLICY,
  DEFAULT_RETRY_POLICY,
  QUEUE_BOOKING,
} from "./queue.constants";
import {
  ExpirePaymentJobPayload,
  ProcessNoShowJobPayload,
} from "../jobs/booking.jobs";
import { PrismaService } from "@database/prisma/prisma.service";

@Injectable()
export class BookingQueueService {
  private readonly logger = new Logger(BookingQueueService.name);

  constructor(
    @InjectQueue(QUEUE_BOOKING)
    private readonly bookingQueue: Queue<
      ExpirePaymentJobPayload | ProcessNoShowJobPayload
    >,
    private readonly prisma: PrismaService,
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

  /**
   * Schedules an overdue completion check after the booking's end time + grace period (default: 2h).
   */
  async scheduleBookingOverdueCheck(
    bookingId: string,
    gracePeriodMs = 2 * 60 * 60 * 1000,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, bookingDate: true, endTime: true },
    });
    if (!booking) return;

    const appointmentEnd = new Date(booking.bookingDate);
    appointmentEnd.setUTCHours(
      booking.endTime.getUTCHours(),
      booking.endTime.getUTCMinutes(),
      booking.endTime.getUTCSeconds(),
      0,
    );

    const delayOverdue = appointmentEnd.getTime() + gracePeriodMs - Date.now();
    if (delayOverdue > 0) {
      await this.scheduleOverdueCheck(bookingId, delayOverdue);
    }
  }

  async scheduleOverdueCheck(bookingId: string, delayMs: number) {
    const jobId = `overdue-check_${bookingId}`;
    this.logger.log(
      `Scheduling overdue check for booking ${bookingId} in ${delayMs / 1000}s [jobId: ${jobId}]`,
    );

    return await this.bookingQueue.add(
      BOOKING_JOBS.PROCESS_NO_SHOW,
      { bookingId },
      {
        jobId,
        delay: delayMs,
        ...DEFAULT_RETRY_POLICY,
        ...DEFAULT_JOB_REMOVAL_POLICY,
      },
    );
  }

  /**
   * Cancels the overdue check if the provider completes or booking is cancelled.
   */
  async cancelOverdueCheck(bookingId: string) {
    const jobId = `overdue-check_${bookingId}`;
    const job = await this.bookingQueue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.log(`Cancelled overdue check job "${jobId}"`);
      return true;
    }
    return false;
  }
}

import { Processor, WorkerHost } from "@nestjs/bullmq";
import { forwardRef, Inject, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { BOOKING_JOBS, QUEUE_BOOKING } from "../queues/queue.constants";
import {
  ExpirePaymentJobPayload,
  ProcessNoShowJobPayload,
} from "../jobs/booking.jobs";
import { BookingService } from "@modules/booking/services/booking.service";

@Processor(QUEUE_BOOKING, {
  concurrency: 2, // Low concurrency for state transitions to avoid lock contention
})
export class BookingProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingProcessor.name);

  constructor(
    @Inject(forwardRef(() => BookingService))
    private readonly bookingService: BookingService,
  ) {
    super();
  }

  async process(
    job: Job<ExpirePaymentJobPayload | ProcessNoShowJobPayload>,
  ): Promise<any> {
    const startTime = Date.now();
    this.logger.log(
      `Processing booking job [${job.id}] "${job.name}" for booking ${job.data.bookingId}`,
    );

    try {
      let result: any;
      if (job.name === BOOKING_JOBS.EXPIRE_PAYMENT) {
        result = await this.bookingService.expireBooking(job.data.bookingId);
      } else if (job.name === BOOKING_JOBS.PROCESS_NO_SHOW) {
        result = await this.bookingService.flagOverdueBooking(
          job.data.bookingId,
        );
      } else {
        this.logger.warn(`[booking] unhandled job name: "${job.name}"`);
        result = { skipped: true, reason: "unknown_job" };
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `[booking] job completed jobId=${job.id} duration=${duration}ms`,
      );
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.logger.error(
        `[booking] job failed jobId=${job.id} attempt=${job.attemptsMade + 1} duration=${duration}ms error=${error.message}`,
      );
      throw error;
    }
  }
}

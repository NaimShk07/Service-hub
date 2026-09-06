import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUE_BOOKING } from "../queues/queue.constants";
import { ExpirePaymentJobPayload } from "../jobs/booking.jobs";

@Processor(QUEUE_BOOKING, {
  concurrency: 2, // Low concurrency for state transitions to avoid lock contention
})
export class BookingProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingProcessor.name);

  async process(job: Job<ExpirePaymentJobPayload>): Promise<any> {
    this.logger.log(
      `Processing booking job [${job.id}] "${job.name}" for booking ${job.data.bookingId}`,
    );

    // Day 3 will wire the atomic expiration & cancellation cleanup logic here
    return { processed: true, bookingId: job.data.bookingId };
  }
}

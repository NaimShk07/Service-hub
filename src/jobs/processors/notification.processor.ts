import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { SendNotificationJobPayload } from "../jobs/notification.jobs";
import { QUEUE_NOTIFICATION } from "../queues/queue.constants";

@Processor(QUEUE_NOTIFICATION, {
  concurrency: 5,
})
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: Job<SendNotificationJobPayload>): Promise<any> {
    this.logger.log(
      `Processing notification job [${job.id}] "${job.name}" for user ${job.data.userId}`,
    );

    // Day 2 will wire the actual notification dispatch logic here
    return { delivered: true, sentAt: new Date().toISOString() };
  }
}

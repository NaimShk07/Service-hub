import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { SendNotificationJobPayload } from "../jobs/notification.jobs";
import { InjectQueue } from "@nestjs/bullmq";
import {
  DEFAULT_JOB_REMOVAL_POLICY,
  DEFAULT_RETRY_POLICY,
  QUEUE_NOTIFICATION,
} from "./queue.constants";

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @InjectQueue(QUEUE_NOTIFICATION)
    private readonly notificationQueue: Queue<SendNotificationJobPayload>,
  ) {}

  async sendNotification(
    jobName: string,
    data: SendNotificationJobPayload,
    delayMs = 0,
    jobId?: string,
  ) {
    this.logger.log(
      `Scheduling notification "${jobName}" with delay ${delayMs}ms, jobId: ${jobId || "auto"}`,
    );

    return await this.notificationQueue.add(jobName, data, {
      delay: delayMs,
      jobId, // Custom jobId enforces deduplication if same notification is scheduled twice!
      ...DEFAULT_RETRY_POLICY,
      ...DEFAULT_JOB_REMOVAL_POLICY,
    });
  }
}

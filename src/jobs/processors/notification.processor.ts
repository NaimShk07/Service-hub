import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { SendNotificationJobPayload } from "../jobs/notification.jobs";
import { QUEUE_NOTIFICATION } from "../queues/queue.constants";
import { PrismaService } from "@database/prisma/prisma.service";
import { BookingStatus, NotificationStatus } from "@prisma-client/enums";

@Processor(QUEUE_NOTIFICATION, {
  concurrency: 5,
})
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<SendNotificationJobPayload>): Promise<any> {
    const { userId, bookingId, type, channel, title, body } = job.data;

    this.logger.log(
      `Processing notification job [${job.id}] "${job.name}" for user ${job.data.userId}`,
    );

    // 1. Pre-condition Check: If it's a reminder, ensure booking is not CANCELLED
    if (bookingId && job.name.startsWith("reminder.")) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (booking && booking.bookingStatus === BookingStatus.CANCELLED) {
        this.logger.log(
          `Booking "${bookingId}" is CANCELLED. Skipping reminder delivery for job [${job.id}].`,
        );
        return { delivered: false, reason: "booking_cancelled" };
      }
    }

    // 2. Persist Delivery into PostgreSQL
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        bookingId: bookingId || undefined,
        type,
        channel,
        status: NotificationStatus.SENT,
        title,
        body,
        scheduledFor: new Date(job.timestamp),
        sentAt: new Date(),
        attemptCount: job.attemptsMade + 1,
      },
    });

    this.logger.log(
      `✅ Notification [${notification.id}] (${type}) delivered via ${channel} to user ${userId}`,
    );

    return {
      delivered: true,
      notificationId: notification.id,
      sentAt: notification.sentAt,
    };
  }
}

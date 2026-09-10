import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { SendNotificationJobPayload } from "../jobs/notification.jobs";
import { QUEUE_NOTIFICATION } from "../queues/queue.constants";
import { PrismaService } from "@database/prisma/prisma.service";
import {
  BookingStatus,
  NotificationChannel,
  NotificationStatus,
} from "@prisma-client/enums";
import { EmailService } from "@shared/mailer/email.service";

@Processor(QUEUE_NOTIFICATION, {
  concurrency: 5,
})
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<SendNotificationJobPayload>): Promise<any> {
    const startTime = Date.now();
    const { notificationId, userId, bookingId, type, channel, title, body } =
      job.data;

    this.logger.log(
      `[notification] job started jobId=${job.id} name=${job.name} (Attempt ${job.attemptsMade + 1}) for user ${userId}`,
    );

    // 1. Load Notification record
    let notification = notificationId
      ? await this.prisma.notification.findUnique({
          where: { id: notificationId },
        })
      : null;

    if (!notification && bookingId) {
      notification = await this.prisma.notification.findFirst({
        where: {
          bookingId,
          type,
          status: NotificationStatus.PENDING,
        },
      });
    }

    // If still null, create the tracking record now
    if (!notification) {
      notification = await this.prisma.notification.create({
        data: {
          userId,
          bookingId: bookingId || undefined,
          type,
          channel: channel || NotificationChannel.EMAIL,
          status: NotificationStatus.PENDING,
          title,
          body,
          scheduledFor: new Date(job.timestamp),
          attemptCount: 0,
        },
      });
    }

    // Idempotency: skip if already sent
    if (notification && notification.status === NotificationStatus.SENT) {
      this.logger.warn(
        `Notification [${notification.id}] already SENT. Skipping.`,
      );
      return { delivered: true, alreadyProcessed: true };
    }

    // 2. Pre-condition Check: If reminder, check if booking is CANCELLED
    if (bookingId && job.name.startsWith("reminder.")) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (booking && booking.bookingStatus === BookingStatus.CANCELLED) {
        this.logger.log(
          `Booking "${bookingId}" is CANCELLED. Skipping reminder delivery for job [${job.id}].`,
        );
        if (notification) {
          await this.prisma.notification.delete({
            where: { id: notification.id },
          });
        }
        return { delivered: false, reason: "booking_cancelled" };
      }
    }

    // 3. Load Recipient User
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.email) {
      throw new Error(
        `User [${userId}] does not exist or has no email address`,
      );
    }

    try {
      // 4. Send Email via Email Provider Abstraction
      await this.emailService.sendEmail({
        to: user.email,
        subject: title,
        text: body,
      });

      // 5. Success -> Update status to SENT
      const updated = await this.prisma.notification.update({
        where: { id: notification ? notification.id : notificationId },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          attemptCount: job.attemptsMade + 1,
          failureReason: null,
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `[notification] email sent jobId=${job.id} duration=${duration}ms delivered to ${user.email}`,
      );

      return {
        delivered: true,
        notificationId: updated.id,
        sentAt: updated.sentAt,
      };
    } catch (error: any) {
      // 6. Record intermediate attempt count & failure reason in DB, then RE-THROW to trigger BullMQ retry
      const duration = Date.now() - startTime;
      this.logger.warn(
        `[notification] job failed jobId=${job.id} attempt=${job.attemptsMade + 1} duration=${duration}ms error=${error.message}`,
      );
      if (notification) {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            attemptCount: job.attemptsMade + 1,
            failureReason: error.message,
          },
        });
      }

      throw error; // Re-throw triggers BullMQ exponential backoff!
    }
  }

  /**
   * Permanent Failure Hook: Fires when BullMQ exhausts all retries (attempts >= 3)
   */
  @OnWorkerEvent("failed")
  async onFailed(
    job: Job<SendNotificationJobPayload> | undefined,
    error: Error,
  ) {
    if (!job) return;

    const maxAttempts = job.opts.attempts || 3;

    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `🚨 PERMANENT FAILURE: Notification job [${job.id}] "${job.name}" exhausted all ${job.attemptsMade} retries. Reason: ${error.message}`,
      );

      const notificationId = job.data.notificationId;
      if (notificationId) {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: NotificationStatus.FAILED,
            failedAt: new Date(),
            failureReason: error.message,
            attemptCount: job.attemptsMade,
          },
        });
      }
    }
  }
}

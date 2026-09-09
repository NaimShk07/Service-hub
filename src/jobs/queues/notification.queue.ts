import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { SendNotificationJobPayload } from "../jobs/notification.jobs";
import { InjectQueue } from "@nestjs/bullmq";
import {
  DEFAULT_JOB_REMOVAL_POLICY,
  DEFAULT_RETRY_POLICY,
  NOTIFICATION_JOBS,
  QUEUE_NOTIFICATION,
} from "./queue.constants";
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from "@prisma-client/enums";
import { PrismaService } from "@database/prisma/prisma.service";

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @InjectQueue(QUEUE_NOTIFICATION)
    private readonly notificationQueue: Queue<SendNotificationJobPayload>,
    private readonly prisma: PrismaService,
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

    // 1. Persist initial PENDING record in PostgreSQL
    let notificationId = data.notificationId;
    if (!notificationId) {
      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          bookingId: data.bookingId,
          type: data.type,
          channel: data.channel,
          status: NotificationStatus.PENDING,
          title: data.title,
          body: data.body,
          scheduledFor: new Date(Date.now() + delayMs),
          attemptCount: 0,
        },
      });
      notificationId = notification.id;
    }

    // 2. Enqueue BullMQ Job with notificationId
    return await this.notificationQueue.add(
      jobName,
      { ...data, notificationId },
      {
        delay: delayMs,
        jobId, // Custom jobId enforces deduplication if same notification is scheduled twice!
        ...DEFAULT_RETRY_POLICY,
        ...DEFAULT_JOB_REMOVAL_POLICY,
      },
    );
  }

  /**
   * Automatically schedules confirmation, 24h reminder, 2h reminder, and review request.
   */
  async scheduleBookingLifecycleNotifications(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, provider: true },
    });

    if (!booking) {
      this.logger.warn(
        `Booking "${bookingId}" not found. Skipping notifications.`,
      );
      return;
    }

    const now = Date.now();

    // Reconstruct start and end timestamps in UTC
    const appointmentStart = new Date(booking.bookingDate);
    appointmentStart.setUTCHours(
      booking.startTime.getUTCHours(),
      booking.startTime.getUTCMinutes(),
      booking.startTime.getUTCSeconds(),
      0,
    );

    const appointmentEnd = new Date(booking.bookingDate);
    appointmentEnd.setUTCHours(
      booking.endTime.getUTCHours(),
      booking.endTime.getUTCMinutes(),
      booking.endTime.getUTCSeconds(),
      0,
    );

    // 1. Immediate Booking Confirmation
    await this.sendNotification(
      NOTIFICATION_JOBS.BOOKING_CONFIRMATION,
      {
        userId: booking.customerId,
        bookingId: booking.id,
        type: NotificationType.BOOKING_CONFIRMED,
        channel: NotificationChannel.EMAIL,
        title: "Booking Confirmed! 🎉",
        body: `Your booking for "${booking.serviceName}" with ${booking.providerBusinessName} on ${appointmentStart.toDateString()} is confirmed.`,
      },
      0,
      `booking-confirm_${booking.id}`,
    );

    // 2. 24-Hour Reminder (startsAt - 24 hours)
    const delay24h = appointmentStart.getTime() - 24 * 60 * 60 * 1000 - now;
    if (delay24h > 0) {
      await this.sendNotification(
        NOTIFICATION_JOBS.REMINDER_24H,
        {
          userId: booking.customerId,
          bookingId: booking.id,
          type: NotificationType.REMINDER,
          channel: NotificationChannel.EMAIL,
          title: "Reminder: Service Tomorrow ⏰",
          body: `Reminder: Your service "${booking.serviceName}" is scheduled for tomorrow at ${appointmentStart.toTimeString().slice(0, 5)} UTC.`,
        },
        delay24h,
        `reminder-24h_${booking.id}`,
      );
      this.logger.log(
        `Scheduled 24h reminder for booking ${booking.id} in ${Math.round(delay24h / 60000)} mins`,
      );
    }

    // 3. 2-Hour Reminder (startsAt - 2 hours)
    const delay2h = appointmentStart.getTime() - 2 * 60 * 60 * 1000 - now;
    if (delay2h > 0) {
      await this.sendNotification(
        NOTIFICATION_JOBS.REMINDER_2H,
        {
          userId: booking.customerId,
          bookingId: booking.id,
          type: NotificationType.REMINDER,
          channel: NotificationChannel.PUSH,
          title: "Reminder: Provider Arriving in 2 Hours 🚀",
          body: `Your provider ${booking.providerBusinessName} will arrive in 2 hours for "${booking.serviceName}".`,
        },
        delay2h,
        `reminder-2h_${booking.id}`,
      );
      this.logger.log(
        `Scheduled 2h reminder for booking ${booking.id} in ${Math.round(delay2h / 60000)} mins`,
      );
    }

    // 4. Post-Service Review Request (endsAt + 1 hour)
    const delayReview = appointmentEnd.getTime() + 1 * 60 * 60 * 1000 - now;
    if (delayReview > 0) {
      await this.sendNotification(
        NOTIFICATION_JOBS.REVIEW_REQUEST,
        {
          userId: booking.customerId,
          bookingId: booking.id,
          type: NotificationType.REVIEW_REQUEST,
          channel: NotificationChannel.EMAIL,
          title: "How was your service? ⭐",
          body: `Please rate your experience with ${booking.providerBusinessName} for "${booking.serviceName}".`,
        },
        delayReview,
        `review-request_${booking.id}`,
      );
      this.logger.log(
        `Scheduled review request for booking ${booking.id} in ${Math.round(delayReview / 60000)} mins`,
      );
    }
  }

  /**
   * Cancels pending delayed reminder jobs if the booking is cancelled.
   */
  async cancelBookingReminders(bookingId: string) {
    const jobIds = [
      `reminder-24h_${bookingId}`,
      `reminder-2h_${bookingId}`,
      `review-request_${bookingId}`,
    ];
    for (const jobId of jobIds) {
      const job = await this.notificationQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Removed delayed notification job: "${jobId}"`);
      }
    }

    // Also remove pending notification records for cancelled booking
    await this.prisma.notification.deleteMany({
      where: {
        bookingId,
        status: NotificationStatus.PENDING,
      },
    });
  }
}

import { NotificationChannel, NotificationType } from "@prisma-client/enums";

export interface SendNotificationJobPayload {
  notificationId?: string;
  userId: string;
  bookingId?: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  metadata?: Record<string, any>;
}

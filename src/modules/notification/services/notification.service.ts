import { Injectable, NotFoundException } from "@nestjs/common";
import { NotificationRepository } from "../repositories/notification.repository";

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async getUserNotifications(userId: string) {
    return await this.notificationRepository.findByUserId(userId);
  }

  async getUserNotificationsUnreadCount(userId: string) {
    const count = await this.notificationRepository.countUnread(userId);
    return { count };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification =
      await this.notificationRepository.findById(notificationId);

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException(
        `Notification with ID "${notificationId}" not found`,
      );
    }

    if (notification.readAt) {
      return notification; // Idempotent: already read, return as-is
    }

    return await this.notificationRepository.markAsRead(notificationId, userId);
  }

  async markAllAsRead(userId: string) {
    return await this.notificationRepository.markAllAsRead(userId);
  }
}

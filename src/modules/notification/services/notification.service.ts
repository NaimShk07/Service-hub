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

  async markAsRead(notificationId: string, userId: string) {
    const notification =
      await this.notificationRepository.findById(notificationId);

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException(
        `Notification with ID "${notificationId}" not found`,
      );
    }

    return {
      success: true,
      message: "Notification marked as read",
      notificationId,
    };
  }
}

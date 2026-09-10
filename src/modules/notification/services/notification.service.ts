import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@database/prisma/prisma.service";

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserNotifications(userId: string) {
    return await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bookingId: true,
        type: true,
        channel: true,
        status: true,
        title: true,
        body: true,
        scheduledFor: true,
        sentAt: true,
        createdAt: true,
      },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

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

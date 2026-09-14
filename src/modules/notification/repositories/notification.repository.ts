import { Injectable } from "@nestjs/common";
import { PrismaService } from "@database/prisma/prisma.service";
import { BaseRepository } from "@database/repositories/base.repository";
import { Notification, Prisma } from "@prisma-client/client";

@Injectable()
export class NotificationRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByUserId(userId: string) {
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
        readAt: true,
        createdAt: true,
      },
    });
  }

  async findById(id: string) {
    return await this.prisma.notification.findUnique({
      where: { id },
    });
  }

  async create(
    data: Prisma.NotificationUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return await client.notification.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.NotificationUpdateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return await client.notification.update({
      where: { id },
      data,
    });
  }

  async countUnread(userId: string): Promise<number> {
    return await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    return await this.prisma.notification.update({
      where: { id, userId, readAt: null },
      data: {
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    return await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: {
        readAt: new Date(),
      },
    });
  }
}

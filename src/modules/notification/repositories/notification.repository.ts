import { Injectable } from "@nestjs/common";
import { PrismaService } from "@database/prisma/prisma.service";
import { BaseRepository } from "@database/repositories/base.repository";
import { Prisma } from "@prisma-client/client";

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
}

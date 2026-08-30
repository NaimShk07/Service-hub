import { PrismaService } from "@database/prisma/prisma.service";
import { BaseRepository } from "@database/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { BookingStatus, Prisma } from "@prisma-client/client";

@Injectable()
export class BookingRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(
    data: Prisma.BookingUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.booking.create({
      data,
    });
  }

  async findById(id: string) {
    return await this.prisma.booking.findUnique({
      where: {
        id,
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
        provider: {
          select: {
            id: true,
            userId: true,
            businessName: true,
            profileImageUrl: true,
          },
        },
        providerService: true,
      },
    });
  }

  async updateStatus(id: string, status: BookingStatus, reason?: string) {
    return await this.prisma.booking.update({
      where: { id },
      data: {
        bookingStatus: status,
        ...(reason && { reason }),
      },
    });
  }
}

import { PrismaService } from "@database/prisma/prisma.service";
import { BaseRepository } from "@database/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { BookingStatus, Prisma } from "@prisma-client/client";
import { QueryBookingsDto } from "../dto/query-booking.dto";

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
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
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

  async findCustomerBooking(customerId: string, queryDto: QueryBookingsDto) {
    const { status, from, to, page = 1, limit = 10 } = queryDto;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      customerId,
      ...(status && { bookingStatus: status }),
      ...(from || to
        ? {
            bookingDate: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const query = this.prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ bookingDate: "desc" }, { startTime: "desc" }],
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            profileImageUrl: true,
          },
        },
        providerService: {
          select: {
            id: true,
            price: true,
            durationMinutes: true,
          },
        },
      },
    });

    const total = this.prisma.booking.count({
      where,
    });

    return this.paginate(query, total, page, limit);
  }

  async updateStatus(
    id: string,
    status: BookingStatus,
    cancellationReason?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return await client.booking.update({
      where: { id },
      data: {
        bookingStatus: status,
        ...(cancellationReason && { cancellationReason }),
        ...(status === BookingStatus.CANCELLED && { cancelledAt: new Date() }),
      },
    });
  }
}

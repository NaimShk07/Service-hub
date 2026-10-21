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

  async findAll(
    queryDto: {
      status?: BookingStatus;
      from?: string;
      to?: string;
      dateFrom?: string;
      dateTo?: string;
      customerId?: string;
      providerId?: string;
      paymentStatus?: any;
      page?: number;
      limit?: number;
    },
    filters?: { customerId?: string; providerId?: string },
  ) {
    const { status, page = 1, limit = 10, paymentStatus } = queryDto;
    const fromDate = queryDto.dateFrom || queryDto.from;
    const toDate = queryDto.dateTo || queryDto.to;
    const customerId = filters?.customerId || queryDto.customerId;
    const providerId = filters?.providerId || queryDto.providerId;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      ...(customerId && { customerId }),
      ...(providerId && { providerId }),
      ...(status && { bookingStatus: status }),
      ...(fromDate || toDate
        ? {
            bookingDate: {
              ...(fromDate && { gte: new Date(fromDate) }),
              ...(toDate && {
                lte:
                  toDate.length === 10
                    ? new Date(`${toDate}T23:59:59.999Z`)
                    : new Date(toDate),
              }),
            },
          }
        : {}),
      ...(paymentStatus && {
        payments: {
          some: {
            status: paymentStatus,
          },
        },
      }),
    };

    const query = this.prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ bookingDate: "desc" }, { startTime: "desc" }],
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
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
        payments: {
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
            gateway: true,
            createdAt: true,
          },
        },
      },
    });

    const total = this.prisma.booking.count({ where });

    return this.paginate(query, total, page, limit);
  }

  async findById(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;
    return await client.booking.findUnique({
      where: {
        id,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
          },
        },
        provider: {
          select: {
            id: true,
            userId: true,
            businessName: true,
            profileImageUrl: true,
            averageRating: true,
            totalReviews: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        providerService: true,
        payments: true,
        review: true,
        notifications: {
          select: {
            id: true,
            type: true,
            channel: true,
            status: true,
            sentAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async update(
    id: string,
    data: Prisma.BookingUpdateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return await client.booking.update({
      where: { id },
      data,
    });
  }

  async updateMany(
    params: {
      where: Prisma.BookingWhereInput;
      data: Prisma.BookingUpdateManyMutationInput;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return await client.booking.updateMany({
      where: params.where,
      data: params.data,
    });
  }

  async findCustomerBooking(customerId: string, queryDto: QueryBookingsDto) {
    return this.findAll(queryDto, { customerId });
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

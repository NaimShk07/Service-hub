import { PrismaService } from "@database/prisma/prisma.service";
import { BaseRepository } from "@database/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { PaymentGateway, PaymentStatus, Prisma } from "@prisma-client/client";

@Injectable()
export class PaymentRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(
    data: Prisma.PaymentUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return await client.payment.create({
      data,
    });
  }

  async updateMany(
    params: {
      where: Prisma.PaymentWhereInput;
      data: Prisma.PaymentUpdateManyMutationInput;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return await client.payment.updateMany({
      where: params.where,
      data: params.data,
    });
  }

  async findAll(queryDto: {
    status?: PaymentStatus;
    gateway?: PaymentGateway;
    bookingId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      status,
      gateway,
      bookingId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
    } = queryDto;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      ...(status && { status }),
      ...(gateway && { gateway }),
      ...(bookingId && { bookingId }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && {
                lte: dateTo.includes("T")
                  ? new Date(dateTo)
                  : new Date(`${dateTo}T23:59:59.999Z`),
              }),
            },
          }
        : {}),
    };

    const query = this.prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          select: {
            id: true,
            serviceName: true,
            bookingStatus: true,
            bookingDate: true,
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
          },
        },
      },
    });

    const total = this.prisma.payment.count({ where });

    return this.paginate(query, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            provider: {
              select: { id: true, businessName: true, userId: true },
            },
          },
        },
      },
    });
  }

  async findByBookingId(bookingId: string) {
    return this.prisma.payment.findFirst({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByGatewayOrderId(gatewayOrderId: string) {
    return this.prisma.payment.findUnique({
      where: { gatewayOrderId },
      include: {
        booking: true,
      },
    });
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    details?: {
      gatewayPaymentId?: string;
      gatewaySignature?: string;
      paidAt?: Date;
      refundedAt?: Date;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return await client.payment.update({
      where: { id },
      data: {
        status,
        ...(details?.gatewayPaymentId && {
          gatewayPaymentId: details.gatewayPaymentId,
        }),
        ...(details?.gatewaySignature && {
          gatewaySignature: details.gatewaySignature,
        }),
        ...(details?.paidAt && { paidAt: details.paidAt }),
        ...(details?.refundedAt && { refundedAt: details.refundedAt }),
      },
    });
  }

  async findWebhookEvent(gateway: PaymentGateway, eventId: string) {
    return await this.prisma.paymentWebhookEvent.findUnique({
      where: {
        gateway_eventId: {
          gateway,
          eventId,
        },
      },
    });
  }

  async recordWebhookEvent(
    data: Prisma.PaymentWebhookEventUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return await client.paymentWebhookEvent.create({
      data,
    });
  }

  async markWebhookEventProcessed(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;
    return await client.paymentWebhookEvent.update({
      where: { id },
      data: { processedAt: new Date() },
    });
  }
}

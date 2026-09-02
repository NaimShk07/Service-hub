import { PrismaService } from "@database/prisma/prisma.service";
import { BaseRepository } from "@database/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { PaymentStatus, Prisma } from "@prisma-client/client";

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
}

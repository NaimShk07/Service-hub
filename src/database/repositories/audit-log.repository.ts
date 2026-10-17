import { PrismaService } from "@database/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma-client/client";
import { BaseRepository } from "./base.repository";

export interface CreateAuditLogParams {
  actorUserId?: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(params: CreateAuditLogParams, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;
    return await client.auditLog.create({
      data: {
        actorUserId: params.actorUserId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldValue: params.oldValue ?? Prisma.JsonNull,
        newValue: params.newValue ?? Prisma.JsonNull,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  async findAll(queryDto: {
    action?: AuditAction;
    entityType?: string;
    entityId?: string;
    adminId?: string;
    actorUserId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      action,
      entityType,
      entityId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
    } = queryDto;
    const actorUserId = queryDto.adminId || queryDto.actorUserId;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      ...(action && { action }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(actorUserId && { actorUserId }),
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

    const query = this.prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        actorUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const total = this.prisma.auditLog.count({ where });

    return this.paginate(query, total, page, limit);
  }

  async findById(id: string) {
    return await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        actorUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async findByEntity(entityType: string, entityId: string) {
    return await this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
      include: {
        actorUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }
}

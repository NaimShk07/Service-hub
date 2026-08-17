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

  async create(params: CreateAuditLogParams) {
    return await this.prisma.auditLog.create({
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

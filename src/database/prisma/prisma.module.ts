import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AuditLogRepository } from "@database/repositories/audit-log.repository";

@Global()
@Module({
  providers: [PrismaService, AuditLogRepository],
  exports: [PrismaService, AuditLogRepository],
})
export class PrismaModule {}

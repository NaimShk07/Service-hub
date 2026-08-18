import { Module } from "@nestjs/common";
import { AdminProviderController } from "./controllers/admin-provider.controller";
import { AdminProviderService } from "./services/admin-provider.service";
import { AdminProviderRepository } from "./repositories/admin-provider.repository";
import { AuditLogRepository } from "@database/repositories/audit-log.repository";

@Module({
  imports: [],
  controllers: [AdminProviderController],
  providers: [
    AdminProviderService,
    AdminProviderRepository,
    AuditLogRepository,
  ],
})
export class AdminModule {}

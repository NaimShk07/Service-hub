import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AuditLogRepository } from "@database/repositories/audit-log.repository";
import { QueryAdminAuditLogDto } from "../dto/query-admin-audit-log.dto";

@Injectable()
export class AdminAuditLogService {
  private readonly logger = new Logger(AdminAuditLogService.name);

  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async findAll(queryDto: QueryAdminAuditLogDto) {
    this.logger.log("Admin querying platform-wide audit logs");
    return await this.auditLogRepository.findAll(queryDto);
  }

  async findOne(id: string) {
    this.logger.log(`Admin inspecting audit log: ${id}`);
    const log = await this.auditLogRepository.findById(id);

    if (!log) {
      this.logger.warn(`Audit log with ID "${id}" not found`);
      throw new NotFoundException(`Audit log with ID "${id}" not found`);
    }

    return log;
  }
}

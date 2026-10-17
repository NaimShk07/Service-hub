import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma-client/enums";
import { Auth } from "@common/decorators/auth.decorator";
import { AdminAuditLogService } from "../services/admin-audit-log.service";
import { QueryAdminAuditLogDto } from "../dto/query-admin-audit-log.dto";

@ApiTags("Admin - Audit Logs")
@Controller("admin/audit-logs")
@Auth(Role.ADMIN)
export class AdminAuditLogController {
  constructor(private readonly adminAuditLogService: AdminAuditLogService) {}

  /**
   * Get all platform-wide audit logs with filters and pagination.
   * Strictly append-only: No mutations (POST/PATCH/DELETE) allowed.
   */
  @Get("")
  async findAll(@Query() queryDto: QueryAdminAuditLogDto) {
    return await this.adminAuditLogService.findAll(queryDto);
  }

  /**
   * Get audit log detail by ID
   */
  @Get(":id")
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.adminAuditLogService.findOne(id);
  }
}

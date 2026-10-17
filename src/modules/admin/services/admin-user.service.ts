import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Role, UserStatus } from "@prisma-client/enums";
import { AdminUserRepository } from "../repositories/admin-user.repository";
import { QueryAdminUserDto } from "../dto/query-admin-user.dto";
import { AuditLogRepository } from "@database/repositories/audit-log.repository";

@Injectable()
export class AdminUserService {
  private readonly logger = new Logger(AdminUserService.name);

  constructor(
    private readonly adminUserRepository: AdminUserRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async findAll(queryDto: QueryAdminUserDto) {
    return await this.adminUserRepository.findAllPaginated(queryDto);
  }

  async findOne(id: string) {
    const user = await this.adminUserRepository.findById(id);

    if (!user) {
      this.logger.warn(`User with ID "${id}" not found`);
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
  }

  async updateStatus(id: string, status: UserStatus, adminUserId?: string) {
    const existing = await this.findOne(id);

    // Invariant 1: Admin cannot change their own account status
    if (existing.id === adminUserId) {
      throw new BadRequestException(
        "Admin cannot change their own account status",
      );
    }

    // Invariant 2: Cannot remove or suspend the final active admin
    if (
      existing.role === Role.ADMIN &&
      existing.status === UserStatus.ACTIVE &&
      status !== UserStatus.ACTIVE
    ) {
      const activeAdminCount =
        await this.adminUserRepository.countActiveAdmin();

      if (activeAdminCount <= 1) {
        throw new BadRequestException(
          "Cannot suspend or deactivate the final active administrative account",
        );
      }
    }

    this.logger.log(
      `Admin (${adminUserId ?? "system"}) updating user ${id} status from ${existing.status} to ${status}`,
    );

    const action =
      status === UserStatus.SUSPENDED
        ? AuditAction.USER_SUSPENDED
        : AuditAction.USER_STATUS_UPDATED;

    if (adminUserId) {
      await this.auditLogRepository.create({
        actorUserId: adminUserId,
        entityType: "User",
        entityId: id,
        action,
        oldValue: { status: existing.status },
        newValue: { status },
      });
    }

    const result = await this.adminUserRepository.updateStatus(id, status);

    this.logger.log(`Successfully updated user ${id} status to ${status}`);

    return result;
  }
}

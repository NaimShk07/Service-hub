import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { UserStatus } from "@prisma-client/enums";
import { AdminUserRepository } from "../repositories/admin-user.repository";
import { QueryAdminUserDto } from "../dto/query-admin-user.dto";

@Injectable()
export class AdminUserService {
  private readonly logger = new Logger(AdminUserService.name);

  constructor(private readonly adminUserRepository: AdminUserRepository) {}

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

    if (existing.id === adminUserId) {
      throw new BadRequestException(
        "Admin cannot change their own account status",
      );
    }

    this.logger.log(
      `Admin (${adminUserId ?? "system"}) updating user ${id} status from ${existing.status} to ${status}`,
    );

    const result = await this.adminUserRepository.updateStatus(id, status);

    this.logger.log(`Successfully updated user ${id} status to ${status}`);

    return result;
  }
}

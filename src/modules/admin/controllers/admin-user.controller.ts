import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Role, UserStatus } from "@prisma-client/enums";
import { Auth } from "@common/decorators/auth.decorator";
import { AdminUserService } from "../services/admin-user.service";
import { QueryAdminUserDto } from "../dto/query-admin-user.dto";
import { CurrentUser } from "@common/decorators/current-user.decorator";

@ApiTags("Admin - Users")
@Controller("admin/users")
@Auth(Role.ADMIN)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  /**
   * Get all users
   */
  @Get("")
  async findAll(@Query() queryDto: QueryAdminUserDto) {
    return await this.adminUserService.findAll(queryDto);
  }

  /**
   * Get user by ID
   */
  @Get(":id")
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.adminUserService.findOne(id);
  }

  /**
   * Update user status
   */
  @Patch(":id/status")
  async updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser("userId") adminUserId: string,
    @Body("status", new ParseEnumPipe(UserStatus)) status: UserStatus,
  ) {
    return await this.adminUserService.updateStatus(id, status, adminUserId);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminProviderService } from "../services/admin-provider.service";
import { Role } from "@prisma-client/enums";
import { QueryAdminProviderDto } from "../dto/query-admin-provider.dto";
import { RejectProviderDto } from "../dto/reject-provider.dto";
import { Auth } from "@common/decorators/auth.decorator";
import { CurrentUser } from "@common/decorators/current-user.decorator";

@ApiTags("Admin - Providers")
@Controller("admin/providers")
@Auth(Role.ADMIN)
export class AdminProviderController {
  constructor(private readonly adminProviderService: AdminProviderService) {}

  /**
   * Get all providers
   */
  @Get("")
  async findAll(@Query() queryDto: QueryAdminProviderDto) {
    return await this.adminProviderService.findAll(queryDto);
  }

  /**
   * Get provider by ID
   */
  @Get(":id")
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.adminProviderService.findOne(id);
  }

  /**
   * Verify a provider
   */
  @Patch(":id/verify")
  async verify(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser("userId") adminUserId: string,
  ) {
    return await this.adminProviderService.verifyProvider(id, adminUserId);
  }

  /**
   * Reject a provider
   */
  @Patch(":id/reject")
  async reject(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: RejectProviderDto,
    @CurrentUser("userId") adminUserId: string,
  ) {
    return await this.adminProviderService.rejectProvider(id, dto, adminUserId);
  }

  /**
   * Suspend a provider
   */
  @Patch(":id/suspend")
  async suspend(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser("userId") adminUserId: string,
  ) {
    return await this.adminProviderService.suspendProvider(id, adminUserId);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminProviderService } from "../services/admin-provider.service";
import { Role } from "@prisma-client/enums";
import { QueryAdminProviderDto } from "../dto/query-admin-provider.dto";
import { RejectProviderDto } from "../dto/reject-provider.dto";
import { Auth } from "@common/decorators/auth.decorator";

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
  async verify(@Param("id", new ParseUUIDPipe()) id: string, @Req() req: any) {
    return await this.adminProviderService.verifyProvider(
      id,
      req.user?.sub ?? req.user?.id,
    );
  }

  /**
   * Reject a provider
   */
  @Patch(":id/reject")
  async reject(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: RejectProviderDto,
    @Req() req: any,
  ) {
    return await this.adminProviderService.rejectProvider(
      id,
      dto,
      req.user?.sub ?? req.user?.id,
    );
  }

  /**
   * Suspend a provider
   */
  @Patch(":id/suspend")
  async suspend(@Param("id", new ParseUUIDPipe()) id: string, @Req() req: any) {
    return await this.adminProviderService.suspendProvider(
      id,
      req.user?.sub ?? req.user?.id,
    );
  }
}

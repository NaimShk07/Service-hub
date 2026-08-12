import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { AdminProviderService } from "../services/admin-provider.service";
import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { RoleGuard } from "@modules/auth/guards/roles.guard";
import { Roles } from "@common/decorators/roles.decorator";
import { Role } from "@prisma-client/enums";
import { QueryAdminProviderDto } from "../dto/query-admin-provider.dto";
import { RejectProviderDto } from "../dto/reject-provider.dto";

@ApiTags("Admin - Providers")
@Controller("admin/providers")
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminProviderController {
  constructor(private readonly adminProviderService: AdminProviderService) {}

  @Get("")
  @ApiOperation({ summary: "Get all providers" })
  async findAll(@Query() queryDto: QueryAdminProviderDto) {
    return await this.adminProviderService.findAll(queryDto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get provider by ID" })
  @ApiParam({
    name: "id",
    description: "Provider profile UUID",
    type: String,
    format: "uuid",
  })
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.adminProviderService.findOne(id);
  }

  @Patch(":id/verify")
  @ApiOperation({ summary: "Verify a provider" })
  @ApiParam({
    name: "id",
    description: "Provider profile UUID",
    type: String,
    format: "uuid",
  })
  async verify(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.adminProviderService.verifyProvider(id);
  }

  @Patch(":id/reject")
  @ApiOperation({ summary: "Reject a provider" })
  @ApiParam({
    name: "id",
    description: "Provider profile UUID",
    type: String,
    format: "uuid",
  })
  async reject(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: RejectProviderDto,
  ) {
    return await this.adminProviderService.rejectProvider(id, dto);
  }

  @Patch(":id/suspend")
  @ApiOperation({ summary: "Suspend a provider" })
  @ApiParam({
    name: "id",
    description: "Provider profile UUID",
    type: String,
    format: "uuid",
  })
  async suspend(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.adminProviderService.suspendProvider(id);
  }
}

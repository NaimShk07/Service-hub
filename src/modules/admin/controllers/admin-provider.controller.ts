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
  ApiResponse,
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
  @ApiResponse({ status: 200, description: "Paginated list of providers" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden. Admin access required" })
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
  @ApiResponse({ status: 200, description: "Provider details" })
  @ApiResponse({ status: 400, description: "Invalid UUID format" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden. Admin access required" })
  @ApiResponse({ status: 404, description: "Provider not found" })
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
  @ApiResponse({ status: 200, description: "Provider verified successfully" })
  @ApiResponse({
    status: 400,
    description: "Invalid UUID format or provider not in PENDING state",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden. Admin access required" })
  @ApiResponse({ status: 404, description: "Provider not found" })
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
  @ApiResponse({ status: 200, description: "Provider rejected successfully" })
  @ApiResponse({
    status: 400,
    description: "Validation error or invalid status transition",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden. Admin access required" })
  @ApiResponse({ status: 404, description: "Provider not found" })
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
  @ApiResponse({ status: 200, description: "Provider suspended successfully" })
  @ApiResponse({
    status: 400,
    description: "Invalid UUID format or provider already suspended",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden. Admin access required" })
  @ApiResponse({ status: 404, description: "Provider not found" })
  async suspend(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.adminProviderService.suspendProvider(id);
  }
}

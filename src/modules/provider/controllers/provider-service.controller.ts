import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ProviderServiceService } from "../services/provider-service.service";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { VerifiedProviderGuard } from "@modules/auth/guards/verify-provider.guard";
import { CreateProviderServiceDto } from "../dto/create-provider-service.dto";
import { UpdateProviderServiceDto } from "../dto/update-provider-service.dto";

@ApiTags("Provider - Services")
@Controller("me/provider/services")
@UseGuards(JwtAuthGuard, VerifiedProviderGuard)
@ApiBearerAuth()
export class ProviderServiceController {
  constructor(
    private readonly providerServiceService: ProviderServiceService,
  ) {}

  @Get("")
  @ApiOperation({ summary: "Get provider's offered services" })
  @ApiResponse({
    status: 200,
    description: "List of provider offered services",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden. Provider profile not verified",
  })
  async findAll(@Req() req) {
    return await this.providerServiceService.findAll(req.provider.id);
  }

  @Post("")
  @ApiOperation({ summary: "Add a service offering for provider" })
  @ApiResponse({
    status: 201,
    description: "Provider service created successfully",
  })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden. Provider profile not verified",
  })
  @ApiResponse({ status: 404, description: "Catalog service not found" })
  @ApiResponse({
    status: 409,
    description: "Service already offered by provider",
  })
  async create(@Body() dto: CreateProviderServiceDto, @Req() req) {
    return await this.providerServiceService.create(req.provider.id, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a provider service offering" })
  @ApiParam({
    name: "id",
    description: "Provider service offering UUID",
    type: String,
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Provider service updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Validation error or invalid UUID format",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden. Provider profile not verified",
  })
  @ApiResponse({
    status: 404,
    description: "Provider service offering not found",
  })
  async update(
    @Req() req,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProviderServiceDto,
  ) {
    return await this.providerServiceService.update(req.provider.id, id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Remove a provider service offering" })
  @ApiParam({
    name: "id",
    description: "Provider service offering UUID",
    type: String,
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Provider service offering deleted successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid UUID format" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden. Provider profile not verified",
  })
  @ApiResponse({
    status: 404,
    description: "Provider service offering not found",
  })
  async delete(@Req() req, @Param("id", new ParseUUIDPipe()) id: string) {
    return await this.providerServiceService.remove(req.provider.id, id);
  }
}

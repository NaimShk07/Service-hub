import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ProviderService } from "../services/provider.service";
import { CreateProviderDto } from "../dto/create-provider.dto";
import { UpdateProviderDto } from "../dto/update-provider.dto";

import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { CurrentUser } from "@common/decorators/current-user.decorator";

@ApiTags("Providers")
@Controller("")
export class ProviderController {
  constructor(private readonly providerService: ProviderService) {}

  @Post("me/provider")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create provider profile" })
  @ApiResponse({
    status: 201,
    description: "Provider profile created successfully",
  })
  async createProfile(
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateProviderDto,
  ) {
    return await this.providerService.createProfile(userId, dto);
  }

  @Get("me/provider")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get own provider profile" })
  @ApiResponse({
    status: 200,
    description: "Provider profile retrieved successfully",
  })
  async getOwnProfile(@CurrentUser("userId") userId: string) {
    return await this.providerService.getOwnProfile(userId);
  }

  @Patch("me/provider")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update own provider profile" })
  @ApiResponse({
    status: 200,
    description: "Provider profile updated successfully",
  })
  async updateOwnProfile(
    @CurrentUser("userId") userId: string,
    @Body() dto: UpdateProviderDto,
  ) {
    return await this.providerService.updateOwnProfile(userId, dto);
  }

  @Get("provider/:id")
  @ApiOperation({ summary: "Get provider profile by ID" })
  @ApiResponse({
    status: 200,
    description: "Provider profile retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Provider profile not found" })
  async getProviderById(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.providerService.getProfileById(id);
  }
}

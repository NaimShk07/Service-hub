import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { ProviderAvailabilityService } from "../services/provider-availability.service";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { VerifiedProviderGuard } from "@modules/auth/guards/verify-provider.guard";
import { SetAvailabilityDto } from "../dto/set-availability.dto";

@ApiTags("Provider - Availability")
@Controller("me/provider/availability")
@UseGuards(JwtAuthGuard, VerifiedProviderGuard)
@ApiBearerAuth()
export class ProviderAvailabilityController {
  constructor(
    private readonly providerAvailabilityService: ProviderAvailabilityService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get provider's weekly availability schedule" })
  @ApiResponse({
    status: 200,
    description: "Provider availability schedules retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden. Provider profile not verified",
  })
  async getAvailibity(@Req() req) {
    return await this.providerAvailabilityService.getAvailibity(
      req.provider.id,
    );
  }

  @Put()
  @ApiOperation({
    summary: "Set or replace provider's weekly availability schedule",
  })
  @ApiResponse({
    status: 200,
    description: "Availability schedule updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Validation error or overlapping/invalid time intervals",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden. Provider profile not verified",
  })
  async setAvailibity(@Req() req, @Body() dto: SetAvailabilityDto) {
    return await this.providerAvailabilityService.setAvailibity(
      req.provider.id,
      dto,
    );
  }
}

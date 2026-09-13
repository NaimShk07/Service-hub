import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { ProviderAvailabilityService } from "../services/provider-availability.service";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
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

  /**
   * Get provider's weekly availability schedule
   */
  @Get()
  async getAvailibity(@Req() req) {
    return await this.providerAvailabilityService.getAvailibity(
      req.provider.id,
    );
  }

  /**
   * Set or replace provider's weekly availability schedule
   */
  @Put()
  async setAvailibity(@Req() req, @Body() dto: SetAvailabilityDto) {
    return await this.providerAvailabilityService.setAvailibity(
      req.provider.id,
      dto,
    );
  }
}

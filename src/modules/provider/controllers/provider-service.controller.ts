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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
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

  /**
   * Get provider's offered services
   */
  @Get("")
  async findAll(@Req() req) {
    return await this.providerServiceService.findAll(req.provider.id);
  }

  /**
   * Add a service offering for provider
   */
  @Post("")
  async create(@Body() dto: CreateProviderServiceDto, @Req() req) {
    return await this.providerServiceService.create(req.provider.id, dto);
  }

  /**
   * Update a provider service offering
   */
  @Patch(":id")
  async update(
    @Req() req,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProviderServiceDto,
  ) {
    return await this.providerServiceService.update(req.provider.id, id, dto);
  }

  /**
   * Remove a provider service offering
   */
  @Delete(":id")
  async delete(@Req() req, @Param("id", new ParseUUIDPipe()) id: string) {
    return await this.providerServiceService.remove(req.provider.id, id);
  }
}

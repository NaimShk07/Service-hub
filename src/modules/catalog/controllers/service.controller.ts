import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ServiceService } from "../services/service.service";
import { CreateServiceDto } from "../dto/service/create-service.dto";
import { UpdateServiceDto } from "../dto/service/update-service.dto";
import { QueryServiceDto } from "../dto/service/query-service.dto";
import { Role } from "@prisma-client/enums";
import { Auth } from "@common/decorators/auth.decorator";

@ApiTags("Services")
@Controller("services")
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  /**
   * Get all services
   */
  @Get()
  async findAll(@Query() queryDto: QueryServiceDto) {
    return await this.serviceService.findAll(queryDto);
  }

  /**
   * Get service by ID
   */
  @Get(":id")
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.serviceService.findOne(id);
  }

  /**
   * Create a service (Admin only)
   */
  @Post()
  @Auth(Role.ADMIN)
  async create(@Body() createServiceDto: CreateServiceDto) {
    return await this.serviceService.create(createServiceDto);
  }

  /**
   * Update a service (Admin only)
   */
  @Patch(":id")
  @Auth(Role.ADMIN)
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return await this.serviceService.update(id, updateServiceDto);
  }

  /**
   * Delete a service (Admin only)
   */
  @Delete(":id")
  @Auth(Role.ADMIN)
  async remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.serviceService.remove(id);
  }
}

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
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { ServiceService } from "../services/service.service";
import { CreateServiceDto } from "../dto/service/create-service.dto";
import { UpdateServiceDto } from "../dto/service/update-service.dto";
import { QueryServiceDto } from "../dto/service/query-service.dto";
import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { RoleGuard } from "@modules/auth/guards/roles.guard";
import { Roles } from "@common/decorators/roles.decorator";
import { Role } from "@prisma-client/enums";

@ApiTags("Services")
@Controller("services")
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Get()
  @ApiOperation({ summary: "Get all services" })
  async findAll(@Query() queryDto: QueryServiceDto) {
    return await this.serviceService.findAll(queryDto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get service by ID" })
  @ApiParam({ name: "id", description: "Service ID" })
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.serviceService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a service" })
  @ApiBody({ type: CreateServiceDto })
  async create(@Body() createServiceDto: CreateServiceDto) {
    return await this.serviceService.create(createServiceDto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a service" })
  @ApiParam({ name: "id", description: "Service ID" })
  @ApiBody({ type: UpdateServiceDto })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return await this.serviceService.update(id, updateServiceDto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a service" })
  @ApiParam({ name: "id", description: "Service ID" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.serviceService.remove(id);
  }
}

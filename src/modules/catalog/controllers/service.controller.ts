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
  ApiResponse,
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
  @ApiResponse({ status: 200, description: "Paginated list of services" })
  async findAll(@Query() queryDto: QueryServiceDto) {
    return await this.serviceService.findAll(queryDto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get service by ID" })
  @ApiParam({ name: "id", description: "Service ID", format: "uuid" })
  @ApiResponse({ status: 200, description: "Service details" })
  @ApiResponse({ status: 400, description: "Invalid UUID format" })
  @ApiResponse({ status: 404, description: "Service not found" })
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.serviceService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a service" })
  @ApiBody({ type: CreateServiceDto })
  @ApiResponse({ status: 201, description: "Service created successfully" })
  @ApiResponse({
    status: 400,
    description: "Validation error or invalid category ID",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden. Admin access required" })
  @ApiResponse({ status: 404, description: "Category not found" })
  @ApiResponse({
    status: 409,
    description: "Service name already exists in category",
  })
  async create(@Body() createServiceDto: CreateServiceDto) {
    return await this.serviceService.create(createServiceDto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a service" })
  @ApiParam({ name: "id", description: "Service ID", format: "uuid" })
  @ApiBody({ type: UpdateServiceDto })
  @ApiResponse({ status: 200, description: "Service updated successfully" })
  @ApiResponse({ status: 400, description: "Validation error or invalid UUID" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden. Admin access required" })
  @ApiResponse({ status: 404, description: "Service or Category not found" })
  @ApiResponse({ status: 409, description: "Service name conflict" })
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
  @ApiParam({ name: "id", description: "Service ID", format: "uuid" })
  @ApiResponse({ status: 200, description: "Service deleted successfully" })
  @ApiResponse({ status: 400, description: "Invalid UUID format" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden. Admin access required" })
  @ApiResponse({ status: 404, description: "Service not found" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.serviceService.remove(id);
  }
}

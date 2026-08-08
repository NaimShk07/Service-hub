import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ServiceService } from "../services/service.service";
import { CreateServiceDto } from "../dto/service/create-service.dto";
import { UpdateServiceDto } from "../dto/service/update-service.dto";

@Controller("services")
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Get()
  findAll() {}

  @Get(":id")
  findOne(@Param("id") id: string) {}

  @Post()
  create(@Body() dto: CreateServiceDto) {}

  @Patch("id")
  update(@Param("id") id: string, @Body() dto: UpdateServiceDto) {}

  @Delete("id")
  delete(@Param("id") id: string) {}
}

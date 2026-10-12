import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma-client/enums";
import { Auth } from "@common/decorators/auth.decorator";
import { AdminBookingService } from "../services/admin-booking.service";
import { QueryAdminBookingDto } from "../dto/query-admin-booking.dto";

@ApiTags("Admin - Bookings")
@Controller("admin/bookings")
@Auth(Role.ADMIN)
export class AdminBookingController {
  constructor(private readonly adminBookingService: AdminBookingService) {}

  /**
   * Get all bookings
   */
  @Get("")
  async findAll(@Query() queryDto: QueryAdminBookingDto) {
    return await this.adminBookingService.findAll(queryDto);
  }

  /**
   * Get booking by ID
   */
  @Get(":id")
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.adminBookingService.findOne(id);
  }
}

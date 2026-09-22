import { Body, Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma-client/enums";
import { Auth } from "@common/decorators/auth.decorator";
import { AdminDashboardService } from "../services/admin-dashboard.service";

@ApiTags("Admin - Dashboard")
@Controller("admin/dashboard")
@Auth(Role.ADMIN)
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get()
  async getDashboard() {
    return await this.adminDashboardService.getDashboardStats();
  }
}

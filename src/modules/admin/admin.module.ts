import { Module } from "@nestjs/common";
import { AdminProviderController } from "./controllers/admin-provider.controller";
import { AdminProviderService } from "./services/admin-provider.service";
import { AdminProviderRepository } from "./repositories/admin-provider.repository";
import { AuditLogRepository } from "@database/repositories/audit-log.repository";
import { AdminUserController } from "./controllers/admin-user.controller";
import { AdminUserService } from "./services/admin-user.service";
import { AdminUserRepository } from "./repositories/admin-user.repository";
import { BookingModule } from "@modules/booking/booking.module";
import { AdminBookingService } from "./services/admin-booking.service";
import { AdminBookingController } from "./controllers/admin-booking.controller";
import { PrismaModule } from "@database/prisma/prisma.module";
import { AdminDashboardService } from "./services/admin-dashboard.service";
import { AdminDashboardController } from "./controllers/admin-dashboard.controller";

@Module({
  imports: [BookingModule, PrismaModule],
  controllers: [
    AdminProviderController,
    AdminUserController,
    AdminBookingController,
    AdminDashboardController,
  ],
  providers: [
    AdminProviderService,
    AdminProviderRepository,
    AdminUserService,
    AdminUserRepository,
    AdminBookingService,
    AdminDashboardService,
    AuditLogRepository,
  ],
})
export class AdminModule {}

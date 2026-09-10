import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { NotificationService } from "../services/notification.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(@Request() req: any) {
    const userId = req.user.userId || req.user.id;
    return await this.notificationService.getUserNotifications(userId);
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  async markRead(@Param("id") id: string, @Request() req: any) {
    const userId = req.user.userId || req.user.id;
    return await this.notificationService.markAsRead(id, userId);
  }
}

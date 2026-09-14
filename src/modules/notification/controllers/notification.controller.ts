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
import { CurrentUser } from "@common/decorators/current-user.decorator";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(@CurrentUser("userId") userId: string) {
    return await this.notificationService.getUserNotifications(userId);
  }

  @Get("unread-count")
  async getNotificationsUnreadCount(@CurrentUser("userId") userId: string) {
    return await this.notificationService.getUserNotificationsUnreadCount(
      userId,
    );
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.OK)
  async markReadAll(@CurrentUser("userId") userId: string) {
    return await this.notificationService.markAllAsRead(userId);
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Param("id") id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return await this.notificationService.markAsRead(id, userId);
  }
}

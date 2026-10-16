import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma-client/enums";
import { Auth } from "@common/decorators/auth.decorator";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { AdminPaymentService } from "../services/admin-payment.service";
import { QueryAdminPaymentDto } from "../dto/query-admin-payment.dto";
import { RefundPaymentDto } from "@modules/payment/dto/refund-payment.dto";

@ApiTags("Admin - Payments")
@Controller("admin/payments")
@Auth(Role.ADMIN)
export class AdminPaymentController {
  constructor(private readonly adminPaymentService: AdminPaymentService) {}

  /**
   * Get all payments with platform-wide visibility and filtering
   */
  @Get("")
  async findAll(@Query() queryDto: QueryAdminPaymentDto) {
    return await this.adminPaymentService.findAll(queryDto);
  }

  /**
   * Get deep payment investigation details by ID
   */
  @Get(":id")
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.adminPaymentService.findOne(id);
  }

  /**
   * Admin-initiated refund with safety and idempotency invariants
   */
  @Post(":id/refund")
  async refund(
    @CurrentUser("id") adminUserId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return await this.adminPaymentService.refund(adminUserId, id, dto);
  }
}

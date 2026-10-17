import { Injectable, Logger } from "@nestjs/common";
import { PaymentService } from "@modules/payment/services/payment.service";
import { QueryAdminPaymentDto } from "../dto/query-admin-payment.dto";
import { RefundPaymentDto } from "@modules/payment/dto/refund-payment.dto";

@Injectable()
export class AdminPaymentService {
  private readonly logger = new Logger(AdminPaymentService.name);

  constructor(private readonly paymentService: PaymentService) {}

  async findAll(queryDto: QueryAdminPaymentDto) {
    this.logger.log("Admin requesting platform-wide payment list");
    return await this.paymentService.getAllPaymentsForAdmin(queryDto);
  }

  async findOne(id: string) {
    this.logger.log(`Admin investigating payment details for ID: ${id}`);
    return await this.paymentService.getPaymentByIdForAdmin(id);
  }

  async refund(adminUserId: string, id: string, dto: RefundPaymentDto) {
    this.logger.log(
      `Admin ${adminUserId} initiating refund on payment ID: ${id}`,
    );
    return await this.paymentService.refundPayment(adminUserId, id, dto);
  }
}

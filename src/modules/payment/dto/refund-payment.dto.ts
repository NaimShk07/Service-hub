import { IsNumber, IsOptional, IsPositive, IsString } from "class-validator";

export class RefundPaymentDto {
  /** Amount to refund. If omitted, full payment amount is refunded. */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  /** Operational reason for the refund */
  @IsOptional()
  @IsString()
  reason?: string;
}

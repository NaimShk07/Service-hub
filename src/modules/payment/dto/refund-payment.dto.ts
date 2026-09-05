import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsPositive, IsString } from "class-validator";

export class RefundPaymentDto {
  @ApiPropertyOptional({
    description:
      "Amount to refund. If omitted, full payment amount is refunded.",
    example: 899.99,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    description: "Operational reason for the refund",
    example: "Customer cancellation before appointment window",
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

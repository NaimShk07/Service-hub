import { PaymentGateway, PaymentStatus } from "@prisma-client/enums";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class QueryAdminPaymentDto {
  /** Filter by payment status */
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  /** Filter by payment gateway (e.g. RAZORPAY) */
  @IsEnum(PaymentGateway)
  @IsOptional()
  gateway?: PaymentGateway;

  /** Filter by booking ID (UUID) */
  @IsUUID("4")
  @IsOptional()
  bookingId?: string;

  /** Filter payments created from this date (ISO 8601) */
  @IsISO8601()
  @IsOptional()
  dateFrom?: string;

  /** Filter payments created up to this date (ISO 8601) */
  @IsISO8601()
  @IsOptional()
  dateTo?: string;

  /** Page number */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  /** Items per page */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;
}

import { BookingStatus, PaymentStatus } from "@prisma-client/enums";
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

export class QueryAdminBookingDto {
  /** Filter by booking status */
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  /** Filter by provider ID (ProviderProfile UUID) */
  @IsUUID("4")
  @IsOptional()
  providerId?: string;

  /** Filter by customer ID (User UUID) */
  @IsUUID("4")
  @IsOptional()
  customerId?: string;

  /** Filter bookings from date (ISO 8601 YYYY-MM-DD or full timestamp) */
  @IsISO8601()
  @IsOptional()
  dateFrom?: string;

  /** Backward-compatible alias for dateFrom */
  @IsISO8601()
  @IsOptional()
  from?: string;

  /** Filter bookings to date (ISO 8601 YYYY-MM-DD or full timestamp) */
  @IsISO8601()
  @IsOptional()
  dateTo?: string;

  /** Backward-compatible alias for dateTo */
  @IsISO8601()
  @IsOptional()
  to?: string;

  /** Filter by payment status */
  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

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

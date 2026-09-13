import { BookingStatus } from "@prisma-client/enums";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class QueryBookingsDto {
  /** Filter bookings by status */
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  /** Filter bookings from this date (ISO 8601 YYYY-MM-DD or full timestamp) */
  @IsISO8601()
  @IsOptional()
  from?: string;

  /** Filter bookings up to this date (ISO 8601 YYYY-MM-DD or full timestamp) */
  @IsISO8601()
  @IsOptional()
  to?: string;

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

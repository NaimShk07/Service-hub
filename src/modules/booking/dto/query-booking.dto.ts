import { ApiPropertyOptional } from "@nestjs/swagger";
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
  @ApiPropertyOptional({
    enum: BookingStatus,
    description: "Filter bookings by status",
  })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @ApiPropertyOptional({
    description:
      "Filter bookings from this date (ISO 8601 YYYY-MM-DD or full timestamp)",
    example: "2026-09-01",
  })
  @IsISO8601()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description:
      "Filter bookings up to this date (ISO 8601 YYYY-MM-DD or full timestamp)",
    example: "2026-09-30",
  })
  @IsISO8601()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;
}

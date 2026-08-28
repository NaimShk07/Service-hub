import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class CreateBookingDto {
  @ApiProperty({
    description: "Provider service offering UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  providerServiceId: string;

  @ApiProperty({
    description: "Booking start time in ISO-8601 format",
    example: "2026-08-28T10:00:00+05:30",
  })
  @IsISO8601()
  @IsNotEmpty()
  startsAt: string;

  @ApiPropertyOptional({
    description: "Special instructions or customer notes",
    example: "Please call before arriving.",
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

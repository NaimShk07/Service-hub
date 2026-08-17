import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";

export class AvailabityIntervalDto {
  @ApiProperty({
    description: "Day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)",
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @ApiProperty({
    description: "Start time in HH:mm 24-hour format",
    example: "09:00",
    pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/) // format "HH:mm" (e.g. "18:00")
  startTime: string;

  @ApiProperty({
    description: "End time in HH:mm 24-hour format",
    example: "17:00",
    pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  endTime: string;

  @ApiPropertyOptional({
    description: "Whether provider is available during this interval",
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isAvailable: boolean;
}

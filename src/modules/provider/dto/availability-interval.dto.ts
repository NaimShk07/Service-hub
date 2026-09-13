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
  /** Day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) */
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  /** Start time in HH:mm 24-hour format */
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  startTime: string;

  /** End time in HH:mm 24-hour format */
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  endTime: string;

  /** Whether provider is available during this interval */
  @IsBoolean()
  @IsOptional()
  isAvailable: boolean = true;
}

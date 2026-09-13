import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelBookingDto {
  /** Reason for cancellation */
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

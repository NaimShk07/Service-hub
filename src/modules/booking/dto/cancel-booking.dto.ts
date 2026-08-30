import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelBookingDto {
  @ApiPropertyOptional({
    description: "Reason for cancellation",
    example: "Change of plans / rescheduled.",
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

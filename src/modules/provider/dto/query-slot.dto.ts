import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID, Matches } from "class-validator";

export class QuerySlotDto {
  @ApiProperty({
    description: "Provider service UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({
    description: "Target date in YYYY-MM-DD format",
    example: "2026-08-20",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class CreateProviderServiceDto {
  @ApiProperty({
    description: "Target service catalog UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({
    description: "Offered price for service in INR",
    example: 499.99,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price: number;

  @ApiProperty({
    description: "Service duration in minutes",
    example: 60,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiPropertyOptional({
    description: "Buffer time between bookings in minutes",
    example: 15,
    default: 0,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  bufferMinutes: number;

  @ApiPropertyOptional({
    description: "Custom notes/description for provider service offering",
    example: "Includes diagnostic check and minor spare parts replacement.",
  })
  @IsString()
  @IsOptional()
  description: string;
}

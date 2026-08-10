import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ServiceMode } from "@prisma-client/enums";
import { Transform } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class CreateServiceDto {
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174000",
    description: "ID of the category",
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    example: "AC Repair & Servicing",
    description: "Service name",
  })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: "Full air conditioner maintenance and inspection service",
    description: "Service description",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: ServiceMode,
    example: ServiceMode.AT_CUSTOMER_LOCATION,
    description: "Service delivery mode",
  })
  @IsEnum(ServiceMode)
  @IsNotEmpty()
  serviceMode: ServiceMode;

  @ApiPropertyOptional({
    example: 60,
    default: 0,
    description: "Default duration of service in minutes",
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  defaultDuration?: number = 0;
}

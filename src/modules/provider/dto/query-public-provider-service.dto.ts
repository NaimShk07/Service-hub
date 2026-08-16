import { ApiPropertyOptional } from "@nestjs/swagger";
import { ServiceMode } from "@prisma-client/enums";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class QueryPublicProviderServicesDto {
  @ApiPropertyOptional({
    description: "Filter offered services by Category UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    description: "Filter by service delivery mode",
    enum: ServiceMode,
    example: ServiceMode.AT_CUSTOMER_LOCATION,
  })
  @IsEnum(ServiceMode)
  @IsOptional()
  serviceMode?: ServiceMode;

  @ApiPropertyOptional({
    description: "Search offered services by name",
    example: "AC Repair",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: "Page number for pagination",
    example: 1,
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: "Number of items per page",
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  @Max(100)
  limit: number = 10;
}

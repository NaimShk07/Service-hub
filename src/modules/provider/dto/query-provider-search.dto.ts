import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export enum ProviderSearchSort {
  RATING_DESC = "rating_desc",
  RATING_ASC = "rating_asc",
  PRICE_ASC = "price_asc",
  PRICE_DESC = "price_desc",
  NEWEST = "newest",
}

export class QueryProviderSearchDto {
  @ApiPropertyOptional({ description: "Page number", default: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Items per page",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "Filter by Category UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: "Filter by Catalog Service UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({
    description: "Filter by provider location city",
    example: "Mumbai",
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: "Minimum offered service price in INR",
    example: 100,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: "Maximum offered service price in INR",
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: "Minimum average provider rating",
    example: 4.0,
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ProviderSearchSort)
  sort?: ProviderSearchSort = ProviderSearchSort.RATING_DESC;
}

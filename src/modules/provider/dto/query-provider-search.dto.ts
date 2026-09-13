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
  /** Page number */
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  page?: number = 1;

  /** Items per page */
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** Filter by Category UUID */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Filter by Catalog Service UUID */
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  /** Filter by provider location city */
  @IsOptional()
  @IsString()
  city?: string;

  /** Minimum offered service price in INR */
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  /** Maximum offered service price in INR */
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;

  /** Minimum average provider rating */
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  minRating?: number;

  /** Search text by business name or description */
  @IsOptional()
  @IsString()
  search?: string;

  /** Sort option for search results */
  @IsOptional()
  @IsEnum(ProviderSearchSort)
  sort?: ProviderSearchSort = ProviderSearchSort.RATING_DESC;
}

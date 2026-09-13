import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export enum ReviewSortOption {
  NEWEST = "newest",
  OLDEST = "oldest",
  HIGHEST = "highest",
  LOWEST = "lowest",
}

export class QueryReviewDto {
  /** Page number */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  /** Items per page */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;

  /** Filter by specific star rating (1-5) */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  /** Sorting option: newest, oldest, highest, lowest */
  @IsEnum(ReviewSortOption)
  @IsOptional()
  sort?: ReviewSortOption = ReviewSortOption.NEWEST;
}

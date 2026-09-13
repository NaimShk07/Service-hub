import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export enum ReviewSortOption {
  NEWEST = "newest",
  OLDEST = "oldest",
  HIGHEST = "highest",
  LOWEST = "lowest",
}

export class QueryReviewDto {
  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: "Filter by specific star rating (1-5)",
    minimum: 1,
    maximum: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional({
    enum: ReviewSortOption,
    description: "Sorting option",
    default: ReviewSortOption.NEWEST,
  })
  @IsEnum(ReviewSortOption)
  @IsOptional()
  sort?: ReviewSortOption = ReviewSortOption.NEWEST;
}

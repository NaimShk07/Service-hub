import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateReviewDto {
  /** Updated rating score between 1 and 5 */
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  /** Updated customer feedback / comment (max 1000 characters) */
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  comment?: string;
}

import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateReviewDto {
  /** UUID of the completed booking (optional if passed via URL path) */
  @IsUUID()
  @IsOptional()
  bookingId?: string;

  /** Rating score between 1 and 5 */
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  /** Optional customer feedback / comment (max 1000 characters) */
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comment?: string;
}

import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
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
  @ApiPropertyOptional({
    description:
      "UUID of the completed booking (optional if passed via URL path)",
    example: "a81bc81b-dead-4e5d-abff-90865d1e13b1",
  })
  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @ApiProperty({
    description: "Rating score between 1 and 5",
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    description: "Optional customer feedback / comment (max 1000 characters)",
    example: "Very professional and punctual.",
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comment?: string;
}

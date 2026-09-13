import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateReviewDto {
  @ApiProperty({
    description: "UUID of the completed booking being reviewed",
    example: "a81bc81b-dead-4e5d-abff-90865d1e13b1",
  })
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;

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
    description: "Optional customer feedback / comment",
    example: "Excellent plumbing work! Arrived on time and solved the leakage.",
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comment?: string;
}

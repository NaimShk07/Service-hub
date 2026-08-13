import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCategoryDto {
  @ApiProperty({
    example: "Electronics",
    description: "Category name",
    minLength: 1,
  })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: "Electronic devices and accessories",
    description: "Category description",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: "electronics",
    description: "Category icon",
  })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({
    example: 0,
    default: 0,
    description: "Display order of the category",
    minimum: 0,
    maximum: 32767,
  })
  @IsInt()
  @Min(0)
  @Max(32767)
  displayOrder: number = 0;

  @ApiProperty({
    example: true,
    default: true,
    description: "Whether the category is active",
  })
  @IsBoolean()
  isActive: boolean = true;
}

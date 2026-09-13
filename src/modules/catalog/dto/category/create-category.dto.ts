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

export class CreateCategoryDto {
  /** Category name */
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  name: string;

  /** Category description */
  @IsString()
  @IsOptional()
  description?: string;

  /** Category icon */
  @IsString()
  @IsOptional()
  icon?: string;

  /** Display order of the category */
  @IsInt()
  @Min(0)
  @Max(32767)
  displayOrder: number = 0;

  /** Whether the category is active */
  @IsBoolean()
  isActive: boolean = true;
}

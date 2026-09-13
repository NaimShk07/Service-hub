import { Transform } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";

export class CreateProviderDto {
  /** Unique business name */
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  businessName: string;

  /** Business bio/description */
  @IsString()
  @IsOptional()
  @Length(10, 1000)
  description?: string;

  /** Years of experience */
  @IsInt()
  @Min(0)
  @Max(50)
  experienceYears: number;

  /** Profile image URL */
  @IsUrl()
  @IsOptional()
  profileImageUrl?: string;

  /** Street address */
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  /** Apartment/Suite (optional) */
  @IsString()
  @IsOptional()
  addressLine2?: string;

  /** City */
  @IsString()
  @IsNotEmpty()
  city: string;

  /** State */
  @IsString()
  @IsNotEmpty()
  state: string;

  /** Postal code (5-6 digits) */
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{5,6}$/)
  postalCode: string;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
  @ApiProperty({
    description: "Unique business name",
    example: "Sharma Home Services",
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  businessName: string;

  @ApiPropertyOptional({
    description: "Business bio/description",
    example:
      "Professional home service provider with over 10 years of experience.",
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @Length(10, 1000)
  description?: string;

  @ApiProperty({
    description: "Years of experience",
    example: 10,
    minimum: 0,
    maximum: 50,
  })
  @IsInt()
  @Min(0)
  @Max(50)
  experienceYears: number;

  @ApiPropertyOptional({
    description: "Profile image URL",
    example: "https://example.com/images/provider-profile.jpg",
  })
  @IsUrl()
  @IsOptional()
  profileImageUrl?: string;

  @ApiProperty({
    description: "Street address",
    example: "123 MG Road",
  })
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @ApiPropertyOptional({
    description: "Apartment/Suite (optional)",
    example: "Apartment 402",
  })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiProperty({
    description: "City",
    example: "Ahmedabad",
  })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({
    description: "State",
    example: "Gujarat",
  })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({
    description: "Postal code",
    example: "380001",
    pattern: "^[0-9]{5,6}$",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{5,6}$/)
  postalCode: string;
}

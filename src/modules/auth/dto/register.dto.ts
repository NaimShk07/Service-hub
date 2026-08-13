import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsPhoneNumber, Length } from "class-validator";

export class RegisterDto {
  @ApiProperty({
    example: "john.doe@example.com",
    description: "User's email address",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: "StrongPassword123!",
    description: "Password (8-100 characters)",
    minLength: 8,
    maxLength: 100,
  })
  @IsString()
  @Length(8, 100)
  password: string;

  @ApiProperty({
    example: "John",
    description: "User's first name",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @Length(2, 100)
  firstName: string;

  @ApiProperty({
    example: "Doe",
    description: "User's last name",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @Length(2, 100)
  lastName: string;

  @ApiProperty({
    example: "+919876543210",
    description: "User's Indian phone number",
  })
  @IsPhoneNumber("IN")
  phone: string;
}

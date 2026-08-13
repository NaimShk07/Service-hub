import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length } from "class-validator";

export class LoginDto {
  @ApiProperty({
    example: "john.doe@example.com",
    description: "User's email address",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: "StrongPassword123!",
    description: "User's password",
    minLength: 8,
    maxLength: 100,
  })
  @IsString()
  @Length(8, 100)
  password: string;
}

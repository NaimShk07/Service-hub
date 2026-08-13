import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({
    example: "john.doe@example.com",
    description: "Registered user email address for password reset",
  })
  @IsEmail()
  email: string;
}

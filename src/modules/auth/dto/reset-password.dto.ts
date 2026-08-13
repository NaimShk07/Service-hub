import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Length } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({
    description: "Password reset verification token",
    example: "d9b2a1c0-4e3f-4a12-8c9d-1b2c3d4e5f6a",
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: "New password (8-100 characters)",
    example: "NewStrongPassword123!",
    minLength: 8,
    maxLength: 100,
  })
  @IsString()
  @Length(8, 100)
  newPassword: string;
}

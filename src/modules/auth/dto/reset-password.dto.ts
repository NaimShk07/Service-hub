import { IsNotEmpty, IsString, Length } from "class-validator";

export class ResetPasswordDto {
  /** Password reset verification token */
  @IsString()
  @IsNotEmpty()
  token: string;

  /** New password (8-100 characters) */
  @IsString()
  @Length(8, 100)
  newPassword: string;
}

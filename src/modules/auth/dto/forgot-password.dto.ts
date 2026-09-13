import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
  /** Registered user email address for password reset */
  @IsEmail()
  email: string;
}

import { IsEmail, IsString, Length } from "class-validator";

export class LoginDto {
  /** User's email address */
  @IsEmail()
  email: string;

  /** User's password */
  @IsString()
  @Length(8, 100)
  password: string;
}

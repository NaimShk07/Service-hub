import { IsEmail, IsPhoneNumber, IsString, Length } from "class-validator";

export class RegisterDto {
  /** User's email address */
  @IsEmail()
  email: string;

  /** Password (8-100 characters) */
  @IsString()
  @Length(8, 100)
  password: string;

  /** User's first name */
  @IsString()
  @Length(2, 100)
  firstName: string;

  /** User's last name */
  @IsString()
  @Length(2, 100)
  lastName: string;

  /** User's Indian phone number */
  @IsPhoneNumber("IN")
  phone: string;
}

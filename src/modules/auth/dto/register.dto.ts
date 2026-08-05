import { IsEmail, IsString, IsPhoneNumber, Length } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 100)
  password: string;

  @IsString()
  @Length(2, 100)
  firstName: string;

  @IsString()
  @Length(2, 100)
  lastName: string;

  @IsPhoneNumber("IN")
  phone: string;
}

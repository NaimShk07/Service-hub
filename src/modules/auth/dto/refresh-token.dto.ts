import { IsNotEmpty, IsString } from "class-validator";

export class RefreshTokenDto {
  /** JWT refresh token string */
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

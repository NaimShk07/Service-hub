import { IsEnum, IsNotEmpty } from "class-validator";
import { UserStatus } from "@prisma-client/enums";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus, example: UserStatus.SUSPENDED })
  @IsNotEmpty()
  @IsEnum(UserStatus)
  status: UserStatus;
}

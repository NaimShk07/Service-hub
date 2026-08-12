import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Length } from "class-validator";

export class RejectProviderDto {
  @ApiProperty({
    description: "Reason for rejecting the provider",
    example: "Business registration document is invalid",
    minLength: 5,
    maxLength: 500,
  })
  @IsNotEmpty()
  @IsString()
  @Length(5, 500)
  rejectReason: string;
}

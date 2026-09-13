import { IsNotEmpty, IsString, Length } from "class-validator";

export class RejectProviderDto {
  /** Reason for rejecting the provider */
  @IsNotEmpty()
  @IsString()
  @Length(5, 500)
  rejectReason: string;
}

import { IsNotEmpty, IsString, IsUUID, Matches } from "class-validator";

export class QuerySlotDto {
  /** Provider service UUID */
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  /** Target date in YYYY-MM-DD format */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;
}

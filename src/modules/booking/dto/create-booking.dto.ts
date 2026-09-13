import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class CreateBookingDto {
  /** Provider service offering UUID */
  @IsUUID()
  @IsNotEmpty()
  providerServiceId: string;

  /** Booking start time in ISO-8601 format */
  @IsISO8601()
  @IsNotEmpty()
  startsAt: string;

  /** Special instructions or customer notes */
  @IsString()
  @IsOptional()
  notes?: string;
}

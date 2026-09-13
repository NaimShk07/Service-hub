import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class CreateProviderServiceDto {
  /** Target service catalog UUID */
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  /** Offered price for service in INR */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price: number;

  /** Service duration in minutes */
  @IsInt()
  @Min(1)
  durationMinutes: number;

  /** Buffer time between bookings in minutes */
  @IsInt()
  @Min(0)
  @IsOptional()
  bufferMinutes: number = 0;

  /** Custom notes/description for provider service offering */
  @IsString()
  @IsOptional()
  description?: string;
}

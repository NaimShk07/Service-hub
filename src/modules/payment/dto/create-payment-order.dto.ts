import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class CreatePaymentOrderDto {
  @ApiProperty({
    description: "Booking UUID to create a payment order for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;
}

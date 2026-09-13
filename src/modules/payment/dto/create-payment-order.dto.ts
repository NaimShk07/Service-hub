import { IsNotEmpty, IsUUID } from "class-validator";

export class CreatePaymentOrderDto {
  /** Booking UUID to create a payment order for */
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;
}

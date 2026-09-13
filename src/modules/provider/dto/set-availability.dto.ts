import { IsArray, ValidateNested } from "class-validator";
import { AvailabityIntervalDto } from "./availability-interval.dto";
import { Type } from "class-transformer";

export class SetAvailabilityDto {
  /** List of weekly availability time intervals */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabityIntervalDto)
  schedules: AvailabityIntervalDto[];
}

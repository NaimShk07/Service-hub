import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateProviderServiceDto } from "./create-provider-service.dto";
import { IsBoolean, IsOptional } from "class-validator";

export class UpdateProviderServiceDto extends PartialType(
  OmitType(CreateProviderServiceDto, ["serviceId"] as const),
) {
  /** Enable or disable provider service offering */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

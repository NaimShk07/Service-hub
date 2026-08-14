import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateProviderServiceDto } from "./create-provider-service.dto";

export class UpdateProviderServiceDto extends PartialType(
  OmitType(CreateProviderServiceDto, ["serviceId"] as const),
) {}

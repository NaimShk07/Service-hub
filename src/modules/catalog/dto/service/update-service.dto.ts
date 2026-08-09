import { PartialType } from "@nestjs/mapped-types";
import { CreateServiceDto } from "./create-service.dto";
import { OmitType } from "@nestjs/swagger";

export class UpdateServiceDto extends PartialType(
  OmitType(CreateServiceDto, ["serviceMode"] as const),
) {}

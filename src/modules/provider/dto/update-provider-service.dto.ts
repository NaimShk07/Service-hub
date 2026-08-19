import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { CreateProviderServiceDto } from "./create-provider-service.dto";
import { IsBoolean, IsOptional } from "class-validator";

export class UpdateProviderServiceDto extends PartialType(
  OmitType(CreateProviderServiceDto, ["serviceId"] as const),
) {
  @ApiPropertyOptional({
    description: "Enable or disable provider service offering",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

import { ServiceMode } from "@prisma-client/enums";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class CreateServiceDto {
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsEnum(ServiceMode)
  @IsNotEmpty()
  serviceMode: ServiceMode;

  @IsInt()
  @IsOptional()
  defaultDuration: number = 0;
}

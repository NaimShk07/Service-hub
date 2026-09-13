import { ServiceMode } from "@prisma-client/enums";
import { Transform } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class CreateServiceDto {
  /** ID of the category */
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  /** Service name */
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  name: string;

  /** Service description */
  @IsString()
  @IsOptional()
  description?: string;

  /** Service delivery mode */
  @IsEnum(ServiceMode)
  @IsNotEmpty()
  serviceMode: ServiceMode;

  /** Default duration of service in minutes */
  @IsInt()
  @Min(0)
  @IsOptional()
  defaultDuration?: number = 0;
}

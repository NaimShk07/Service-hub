import { ServiceMode } from "@prisma-client/enums";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class QueryPublicProviderServicesDto {
  /** Filter offered services by Category UUID */
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  /** Filter by service delivery mode */
  @IsEnum(ServiceMode)
  @IsOptional()
  serviceMode?: ServiceMode;

  /** Search offered services by name */
  @IsString()
  @IsOptional()
  search?: string;

  /** Page number for pagination */
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  page: number = 1;

  /** Number of items per page */
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  @Max(100)
  limit: number = 10;
}

import { Type } from "class-transformer";
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class QueryServiceDto {
  /** Filter services by category ID */
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  /** Search services by name */
  @IsString()
  @IsOptional()
  search?: string;

  /** Page number */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  /** Items per page */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

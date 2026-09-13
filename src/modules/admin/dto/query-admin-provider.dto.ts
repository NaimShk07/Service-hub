import { VerificationStatus } from "@prisma-client/enums";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString, Max, Min } from "class-validator";

export class QueryAdminProviderDto {
  /** Filter providers by verification status */
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  /** Search providers by name */
  @IsOptional()
  @IsString()
  search?: string;

  /** Page number */
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  /** Number of providers per page */
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

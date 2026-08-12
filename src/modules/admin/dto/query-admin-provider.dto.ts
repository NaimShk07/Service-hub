import { ApiPropertyOptional } from "@nestjs/swagger";
import { VerificationStatus } from "@prisma-client/enums";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString, Max, Min } from "class-validator";

export class QueryAdminProviderDto {
  @ApiPropertyOptional({
    enum: VerificationStatus,
    description: "Filter providers by verification status",
  })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  @ApiPropertyOptional({
    description: "Search providers by name",
    example: "John",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "Page number",
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Number of providers per page",
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

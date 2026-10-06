import { UserStatus } from "@prisma-client/enums";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString, Max, Min } from "class-validator";

export enum AdminUserRoleFilter {
  USER = "USER",
  ADMIN = "ADMIN",
  PROVIDER = "PROVIDER",
}

export class QueryAdminUserDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(AdminUserRoleFilter)
  role?: AdminUserRoleFilter;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  createdAt?: string;
}

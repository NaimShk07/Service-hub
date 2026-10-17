import { AuditAction } from "@prisma-client/enums";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class QueryAdminAuditLogDto {
  /** Filter by audit action */
  @IsEnum(AuditAction)
  @IsOptional()
  action?: AuditAction;

  /** Filter by entity type (e.g. ProviderProfile, User, Payment, Booking) */
  @IsString()
  @IsOptional()
  entityType?: string;

  /** Filter by target entity ID */
  @IsUUID("4")
  @IsOptional()
  entityId?: string;

  /** Filter by admin actor user ID (adminId) */
  @IsUUID("4")
  @IsOptional()
  adminId?: string;

  /** Backward-compatible alias for adminId */
  @IsUUID("4")
  @IsOptional()
  actorUserId?: string;

  /** Filter audit logs from this date (ISO 8601) */
  @IsISO8601()
  @IsOptional()
  dateFrom?: string;

  /** Filter audit logs up to this date (ISO 8601) */
  @IsISO8601()
  @IsOptional()
  dateTo?: string;

  /** Page number */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  /** Items per page */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;
}

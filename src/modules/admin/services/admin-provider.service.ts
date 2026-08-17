import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AdminProviderRepository } from "../repositories/admin-provider.repository";
import { QueryAdminProviderDto } from "../dto/query-admin-provider.dto";
import { AuditAction, VerificationStatus } from "@prisma-client/enums";
import { RejectProviderDto } from "../dto/reject-provider.dto";
import { AuditLogRepository } from "@database/repositories/audit-log.repository";

@Injectable()
export class AdminProviderService {
  private readonly logger = new Logger(AdminProviderService.name);

  constructor(
    private readonly adminProviderRepository: AdminProviderRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async findAll(queryDto: QueryAdminProviderDto) {
    return await this.adminProviderRepository.findAllPaginated(queryDto);
  }

  async findOne(id: string) {
    const provider = await this.adminProviderRepository.findById(id);

    if (!provider) {
      this.logger.warn(`Provider with ID "${id}" not found`);
      throw new NotFoundException(`Provider profile with ID "${id}" not found`);
    }

    return provider;
  }

  async verifyProvider(id: string, actorUserId?: string) {
    this.logger.log(`Admin (${actorUserId ?? "system"}) verifying provider profile: ${id}`);
    const existing = await this.findOne(id);

    const result = await this.adminProviderRepository.updateVerificationStatus(
      id,
      VerificationStatus.VERIFIED,
    );

    await this.auditLogRepository.create({
      actorUserId,
      entityType: "ProviderProfile",
      entityId: id,
      action: AuditAction.PROVIDER_VERIFIED,
      oldValue: { status: existing.verificationStatus },
      newValue: { status: VerificationStatus.VERIFIED },
    });

    this.logger.log(`Successfully verified provider profile: ${id}`);
    return result;
  }

  async rejectProvider(id: string, dto: RejectProviderDto, actorUserId?: string) {
    this.logger.log(`Admin (${actorUserId ?? "system"}) rejecting provider profile: ${id}`);
    const existing = await this.findOne(id);

    const result = await this.adminProviderRepository.updateVerificationStatus(
      id,
      VerificationStatus.REJECTED,
      dto.rejectReason,
    );

    await this.auditLogRepository.create({
      actorUserId,
      entityType: "ProviderProfile",
      entityId: id,
      action: AuditAction.PROVIDER_VERIFIED,
      oldValue: { status: existing.verificationStatus },
      newValue: { status: VerificationStatus.REJECTED, rejectReason: dto.rejectReason },
    });

    this.logger.log(`Successfully rejected provider profile: ${id}`);
    return result;
  }

  async suspendProvider(id: string, actorUserId?: string) {
    this.logger.log(`Admin (${actorUserId ?? "system"}) suspending provider profile: ${id}`);
    const existing = await this.findOne(id);

    const result = await this.adminProviderRepository.updateVerificationStatus(
      id,
      VerificationStatus.SUSPENDED,
    );

    await this.auditLogRepository.create({
      actorUserId,
      entityType: "ProviderProfile",
      entityId: id,
      action: AuditAction.PROVIDER_VERIFIED,
      oldValue: { status: existing.verificationStatus },
      newValue: { status: VerificationStatus.SUSPENDED },
    });

    this.logger.log(`Successfully suspended provider profile: ${id}`);
    return result;
  }
}

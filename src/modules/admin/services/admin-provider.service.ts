import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AdminProviderRepository } from "../repositories/admin-provider.repository";
import { QueryAdminProviderDto } from "../dto/query-admin-provider.dto";
import { AuditAction, VerificationStatus } from "@prisma-client/enums";
import { RejectProviderDto } from "../dto/reject-provider.dto";
import { AuditLogRepository } from "@database/repositories/audit-log.repository";
import { RedisService } from "@common/cache/redis.service";

@Injectable()
export class AdminProviderService {
  private readonly logger = new Logger(AdminProviderService.name);

  constructor(
    private readonly adminProviderRepository: AdminProviderRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly redisService: RedisService,
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
    this.logger.log(
      `Admin (${actorUserId ?? "system"}) verifying provider profile: ${id}`,
    );
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
    await this.redisService.del(`provider:profile:${id}`);
    await this.redisService.incrementSearchVersion();

    return result;
  }

  async rejectProvider(
    id: string,
    dto: RejectProviderDto,
    actorUserId?: string,
  ) {
    this.logger.log(
      `Admin (${actorUserId ?? "system"}) rejecting provider profile: ${id}`,
    );
    const existing = await this.findOne(id);

    const result = await this.adminProviderRepository.updateVerificationStatus(
      id,
      VerificationStatus.REJECTED,
      dto.reason,
    );

    await this.auditLogRepository.create({
      actorUserId,
      entityType: "ProviderProfile",
      entityId: id,
      action: AuditAction.PROVIDER_REJECTED,
      oldValue: { status: existing.verificationStatus },
      newValue: {
        status: VerificationStatus.REJECTED,
        rejectReason: dto.reason,
      },
    });

    this.logger.log(`Successfully rejected provider profile: ${id}`);
    await this.redisService.del(`provider:profile:${id}`);
    await this.redisService.incrementSearchVersion();

    return result;
  }

  async suspendProvider(id: string, actorUserId?: string) {
    this.logger.log(
      `Admin (${actorUserId ?? "system"}) suspending provider profile: ${id}`,
    );
    const existing = await this.findOne(id);

    if (existing.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new BadRequestException(
        `Cannot suspend provider with status '${existing.verificationStatus}'. Only VERIFIED providers can be suspended.`,
      );
    }

    const result = await this.adminProviderRepository.updateVerificationStatus(
      id,
      VerificationStatus.SUSPENDED,
    );

    await this.auditLogRepository.create({
      actorUserId,
      entityType: "ProviderProfile",
      entityId: id,
      action: AuditAction.PROVIDER_SUSPENDED,
      oldValue: { status: existing.verificationStatus },
      newValue: { status: VerificationStatus.SUSPENDED },
    });

    this.logger.log(`Successfully suspended provider profile: ${id}`);
    await this.redisService.del(`provider:profile:${id}`);
    await this.redisService.incrementSearchVersion();

    return result;
  }
}

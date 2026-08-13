import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AdminProviderRepository } from "../repositories/admin-provider.repository";
import { QueryAdminProviderDto } from "../dto/query-admin-provider.dto";
import { VerificationStatus } from "@prisma-client/enums";
import { RejectProviderDto } from "../dto/reject-provider.dto";

@Injectable()
export class AdminProviderService {
  private readonly logger = new Logger(AdminProviderService.name);

  constructor(
    private readonly adminProviderRepository: AdminProviderRepository,
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

  async verifyProvider(id: string) {
    this.logger.log(`Admin verifying provider profile: ${id}`);
    await this.findOne(id);

    const result = await this.adminProviderRepository.updateVerificationStatus(
      id,
      VerificationStatus.VERIFIED,
    );
    this.logger.log(`Successfully verified provider profile: ${id}`);
    return result;
  }

  async rejectProvider(id: string, dto: RejectProviderDto) {
    this.logger.log(`Admin rejecting provider profile: ${id}`);
    await this.findOne(id);

    const result = await this.adminProviderRepository.updateVerificationStatus(
      id,
      VerificationStatus.REJECTED,
      dto.rejectReason,
    );
    this.logger.log(`Successfully rejected provider profile: ${id}`);
    return result;
  }

  async suspendProvider(id: string) {
    this.logger.log(`Admin suspending provider profile: ${id}`);
    await this.findOne(id);

    const result = await this.adminProviderRepository.updateVerificationStatus(
      id,
      VerificationStatus.SUSPENDED,
    );
    this.logger.log(`Successfully suspended provider profile: ${id}`);
    return result;
  }
}

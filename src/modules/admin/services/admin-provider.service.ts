import { Injectable, NotFoundException } from "@nestjs/common";
import { AdminProviderRepository } from "../repositories/admin-provider.repository";
import { QueryAdminProviderDto } from "../dto/query-admin-provider.dto";
import { VerificationStatus } from "@prisma-client/enums";
import { RejectProviderDto } from "../dto/reject-provider.dto";

@Injectable()
export class AdminProviderService {
  constructor(
    private readonly adminProviderRepository: AdminProviderRepository,
  ) {}

  async findAll(queryDto: QueryAdminProviderDto) {
    return await this.adminProviderRepository.findAllPaginated(queryDto);
  }

  async findOne(id: string) {
    const provider = await this.adminProviderRepository.findById(id);

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    return provider;
  }

  async verifyProvider(id: string) {
    await this.findOne(id);

    return this.adminProviderRepository.updateVerificationStatus(
      id,
      VerificationStatus.VERIFIED,
    );
  }

  async rejectProvider(id: string, dto: RejectProviderDto) {
    await this.findOne(id);

    return this.adminProviderRepository.updateVerificationStatus(
      id,
      VerificationStatus.REJECTED,
      dto.rejectReason,
    );
  }

  async suspendProvider(id: string) {
    await this.findOne(id);

    return this.adminProviderRepository.updateVerificationStatus(
      id,
      VerificationStatus.SUSPENDED,
    );
  }
}

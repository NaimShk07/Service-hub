import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ProviderServiceRepository } from "../repositories/provider-service.repository";
import { ServiceRepository } from "@modules/catalog/repositories/service.repository";
import { UpdateProviderServiceDto } from "../dto/update-provider-service.dto";
import { CreateProviderServiceDto } from "../dto/create-provider-service.dto";
import { QueryPublicProviderServicesDto } from "../dto/query-public-provider-service.dto";
import { ProviderRepository } from "../repositories/provider.repository";

@Injectable()
export class ProviderServiceService {
  private readonly logger = new Logger(ProviderServiceService.name);

  constructor(
    private readonly providerServiceRepository: ProviderServiceRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly providerRepository: ProviderRepository,
  ) {}

  async create(providerId: string, dto: CreateProviderServiceDto) {
    this.logger.log(
      `Adding service "${dto.serviceId}" to provider offering: ${providerId}`,
    );
    const service = await this.serviceRepository.findById(dto.serviceId);

    if (!service || !service.isActive) {
      this.logger.warn(
        `Catalog service "${dto.serviceId}" not found or inactive`,
      );
      throw new NotFoundException("Catalog service not found or inactive");
    }

    const providerService =
      await this.providerServiceRepository.findByProviderAndServiceId(
        providerId,
        dto.serviceId,
      );

    if (providerService) {
      this.logger.warn(
        `Service "${dto.serviceId}" is already offered by provider: ${providerId}`,
      );
      throw new ConflictException("Service is already added to your offerings");
    }

    const created = await this.providerServiceRepository.create(
      providerId,
      dto,
    );
    this.logger.log(
      `Successfully added service offering "${created.id}" for provider: ${providerId}`,
    );
    return created;
  }

  async findAll(providerId: string) {
    return await this.providerServiceRepository.findByProviderId(providerId);
  }

  async update(providerId: string, id: string, dto: UpdateProviderServiceDto) {
    this.logger.log(
      `Updating provider service offering "${id}" for provider: ${providerId}`,
    );
    const providerService = await this.providerServiceRepository.findById(id);

    if (!providerService || providerService.providerId !== providerId) {
      this.logger.warn(
        `Provider service offering "${id}" not found for provider: ${providerId}`,
      );
      throw new NotFoundException("Provider service offering not found");
    }

    const updated = await this.providerServiceRepository.update(id, dto);
    this.logger.log(`Successfully updated provider service offering "${id}"`);
    return updated;
  }

  async remove(providerId: string, id: string) {
    this.logger.log(
      `Deleting provider service offering "${id}" for provider: ${providerId}`,
    );
    const providerService = await this.providerServiceRepository.findById(id);

    if (!providerService || providerService.providerId !== providerId) {
      this.logger.warn(
        `Provider service offering "${id}" not found for provider: ${providerId}`,
      );
      throw new NotFoundException("Provider service offering not found");
    }

    const result = await this.providerServiceRepository.delete(id);
    this.logger.log(`Successfully deleted provider service offering "${id}"`);
    return result;
  }

  async getPublicProviderServices(
    providerId: string,
    queryDto: QueryPublicProviderServicesDto,
  ) {
    const providerProfile = await this.providerRepository.findById(providerId);

    if (!providerProfile) {
      throw new NotFoundException("Provider not found");
    }

    return await this.providerServiceRepository.findPublicProviderService(
      providerId,
      queryDto,
    );
  }
}

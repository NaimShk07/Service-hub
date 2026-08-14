import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ProviderServiceRepository } from "../repositories/provider-service.repository";
import { ServiceRepository } from "@modules/catalog/repositories/service.repository";
import { UpdateProviderServiceDto } from "../dto/update-provider-service.dto";
import { CreateProviderServiceDto } from "../dto/create-provider-service.dto";

@Injectable()
export class ProviderServiceService {
  constructor(
    private readonly providerServiceRepository: ProviderServiceRepository,
    private readonly serviceRepository: ServiceRepository,
  ) {}

  async create(providerId: string, dto: CreateProviderServiceDto) {
    const service = await this.serviceRepository.findById(dto.serviceId);

    if (!service || !service.isActive) {
      throw new NotFoundException("Catalog service not found or inactive");
    }

    const providerService =
      await this.providerServiceRepository.findByProviderAndServiceId(
        providerId,
        dto.serviceId,
      );

    if (providerService) {
      throw new ConflictException("Service is already added to your offerings");
    }

    return await this.providerServiceRepository.create(providerId, dto);
  }

  async findAll(providerId: string) {
    return await this.providerServiceRepository.findByProviderId(providerId);
  }

  async update(providerId: string, id: string, dto: UpdateProviderServiceDto) {
    const providerService = await this.providerServiceRepository.findById(id);

    if (!providerService || providerService.providerId !== providerId) {
      throw new NotFoundException("Provider service offering not found");
    }

    return await this.providerServiceRepository.update(id, dto);
  }

  async remove(providerId: string, id: string) {
    const providerService = await this.providerServiceRepository.findById(id);

    if (!providerService || providerService.providerId !== providerId) {
      throw new NotFoundException("Provider service offering not found");
    }

    return await this.providerServiceRepository.delete(id);
  }
}

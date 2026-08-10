import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ProviderRepository } from "../repositories/provider.repository";
import { CreateProviderDto } from "../dto/create-provider.dto";
import { UpdateProviderDto } from "../dto/update-provider.dto";

@Injectable()
export class ProviderService {
  constructor(private readonly providerRepository: ProviderRepository) {}

  async createProfile(userId: string, dto: CreateProviderDto) {
    const isUserExist = await this.providerRepository.findByUserId(userId);

    if (isUserExist) {
      throw new ConflictException("User is already registered as a provider");
    }

    const isDuplicate = await this.providerRepository.findByBusinessName(
      dto.businessName,
    );

    if (isDuplicate) {
      throw new ConflictException("Business name already exists");
    }

    return await this.providerRepository.create(userId, dto);
  }

  async getOwnProfile(userId: string) {
    const profile = await this.providerRepository.findByUserId(userId);

    if (!profile) {
      throw new NotFoundException("Provider profile not found for this user");
    }

    return profile;
  }

  async updateOwnProfile(userId: string, dto: UpdateProviderDto) {
    const profile = await this.providerRepository.findByUserId(userId);

    if (!profile) {
      throw new NotFoundException("Provider profile not found for this user");
    }

    if (dto.businessName) {
      const isDuplicate = await this.providerRepository.findByBusinessName(
        dto.businessName,
      );

      if (isDuplicate && isDuplicate.id !== profile.id) {
        throw new ConflictException("Business name already exists");
      }
    }

    return await this.providerRepository.update(profile.id, dto);
  }

  async getProfileById(id: string) {
    const profile = await this.providerRepository.findById(id);

    if (!profile) {
      throw new NotFoundException("Provider not found");
    }

    return profile;
  }
}

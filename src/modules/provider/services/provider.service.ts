import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ProviderRepository } from "../repositories/provider.repository";
import { CreateProviderDto } from "../dto/create-provider.dto";
import { UpdateProviderDto } from "../dto/update-provider.dto";
import { DocumentRepository } from "../repositories/document.repository";
import { UploadDocumentDto } from "../dto/upload-document.dto";
import { StorageService } from "@common/storage/storage.service";

@Injectable()
export class ProviderService {
  constructor(
    private readonly providerRepository: ProviderRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly storageService: StorageService,
  ) {}

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
    const provider = await this.providerRepository.findById(id);

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    return provider;
  }

  async uploadDocument(
    userId: string,
    dto: UploadDocumentDto,
    file: Express.Multer.File,
  ) {
    const provider = await this.providerRepository.findByUserId(userId);
    if (!provider) {
      throw new NotFoundException("Provider profile not found");
    }

    const document = await this.documentRepository.findDocumentByType(
      provider.id,
      dto.documentType,
    );

    if (document) {
      throw new ConflictException(
        `Document of type ${dto.documentType} already uploaded`,
      );
    }

    const fileUrl = await this.storageService.uploadFile(file, "documents");
    return await this.documentRepository.createDocument(
      provider.id,
      dto.documentType,
      fileUrl,
    );
  }

  async getProviderDocumentsForAdmin(providerId: string) {
    const provider = await this.providerRepository.findById(providerId);

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    return await this.documentRepository.findDocumentsByProviderId(providerId);
  }
}

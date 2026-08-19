import {
  ConflictException,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    private readonly providerRepository: ProviderRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly storageService: StorageService,
  ) {}

  async createProfile(userId: string, dto: CreateProviderDto) {
    this.logger.log(`Creating provider profile for user: ${userId}`);

    const [isUserExist, isDuplicate] = await Promise.all([
      this.providerRepository.findByUserId(userId),
      this.providerRepository.findByBusinessName(dto.businessName),
    ]);

    if (isUserExist) {
      this.logger.warn(`User ${userId} is already registered as a provider`);
      throw new ConflictException("User is already registered as a provider");
    }

    if (isDuplicate) {
      this.logger.warn(`Business name "${dto.businessName}" already exists`);
      throw new ConflictException(
        `Business name "${dto.businessName}" already exists`,
      );
    }

    const profile = await this.providerRepository.create(userId, dto);
    this.logger.log(
      `Successfully created provider profile: ${profile.id} for user: ${userId}`,
    );
    return profile;
  }

  async getOwnProfile(userId: string) {
    const profile = await this.providerRepository.findByUserId(userId);

    if (!profile) {
      throw new NotFoundException("Provider profile not found for this user");
    }

    return profile;
  }

  async updateOwnProfile(userId: string, dto: UpdateProviderDto) {
    this.logger.log(`Updating provider profile for user: ${userId}`);
    const profile = await this.providerRepository.findByUserId(userId);

    if (!profile) {
      throw new NotFoundException("Provider profile not found for this user");
    }

    if (dto.businessName) {
      const isDuplicate = await this.providerRepository.findByBusinessName(
        dto.businessName,
      );

      if (isDuplicate && isDuplicate.id !== profile.id) {
        this.logger.warn(
          `Business name "${dto.businessName}" is already taken`,
        );
        throw new ConflictException(
          `Business name "${dto.businessName}" already exists`,
        );
      }
    }

    const updated = await this.providerRepository.update(profile.id, dto);
    this.logger.log(`Successfully updated provider profile: ${profile.id}`);
    return updated;
  }

  async getProfileById(id: string) {
    const provider = await this.providerRepository.findById(id);

    if (!provider) {
      throw new NotFoundException(`Provider profile with ID "${id}" not found`);
    }

    return provider;
  }

  async uploadDocument(
    userId: string,
    dto: UploadDocumentDto,
    file: Express.Multer.File,
  ) {
    this.logger.log(
      `Uploading document "${dto.documentType}" for user: ${userId}`,
    );
    const provider = await this.providerRepository.findByUserId(userId);
    if (!provider) {
      throw new NotFoundException("Provider profile not found for this user");
    }

    const document = await this.documentRepository.findDocumentByType(
      provider.id,
      dto.documentType,
    );

    if (document) {
      this.logger.warn(
        `Document of type "${dto.documentType}" already uploaded for provider: ${provider.id}`,
      );
      throw new ConflictException(
        `Document of type ${dto.documentType} already uploaded`,
      );
    }

    const fileUrl = await this.storageService.uploadFile(file, "documents");
    const doc = await this.documentRepository.createDocument(
      provider.id,
      dto.documentType,
      fileUrl,
    );
    this.logger.log(
      `Successfully uploaded document "${doc.id}" of type "${dto.documentType}" for provider: ${provider.id}`,
    );
    return doc;
  }

  async getProviderDocumentsForAdmin(providerId: string) {
    const provider = await this.providerRepository.findById(providerId);

    if (!provider) {
      throw new NotFoundException(`Provider with ID "${providerId}" not found`);
    }

    return await this.documentRepository.findDocumentsByProviderId(providerId);
  }

  async getPublicProfileById(providerId: string) {
    const provider = await this.providerRepository.findPublicById(providerId);

    if (!provider) {
      throw new NotFoundException(
        `Provider profile with ID "${providerId}" not found`,
      );
    }

    return provider;
  }
}

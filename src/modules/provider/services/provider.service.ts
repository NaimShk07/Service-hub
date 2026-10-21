import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "@prisma-client/enums";
import * as path from "path";

import { ProviderRepository } from "../repositories/provider.repository";
import { CreateProviderDto } from "../dto/create-provider.dto";
import { UpdateProviderDto } from "../dto/update-provider.dto";
import { DocumentRepository } from "../repositories/document.repository";
import { UploadDocumentDto } from "../dto/upload-document.dto";
import { StorageService } from "@common/storage/storage.service";
import {
  ProviderSearchSort,
  QueryProviderSearchDto,
} from "../dto/query-provider-search.dto";
import { RedisService } from "@common/cache/redis.service";
import { buildNormalizedQueryKey } from "@common/utils/cache-key-builder.util";
import { CACHE_TTL } from "@common/constants/cache-ttl.constant";

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    private readonly providerRepository: ProviderRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly storageService: StorageService,
    private readonly redisService: RedisService,
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
    await this.redisService.del(`provider:profile:${profile.id}`);
    await this.redisService.incrementSearchVersion();
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

  async getOwnDocuments(userId: string) {
    const provider = await this.providerRepository.findByUserId(userId);
    if (!provider) {
      throw new NotFoundException("Provider profile not found for user");
    }

    return await this.documentRepository.findDocumentsByProviderId(provider.id);
  }

  async getDocumentFileForUser(
    documentId: string,
    userId: string,
    role: Role,
  ): Promise<{ filePath: string; mimeType: string }> {
    const doc = await this.documentRepository.findDocumentById(documentId);
    if (!doc) {
      throw new NotFoundException(`Document "${documentId}" not found`);
    }

    // Role check: must be ADMIN or the owner of the provider profile
    if (role !== Role.ADMIN) {
      const provider = await this.providerRepository.findById(doc.providerId);
      if (!provider || provider.userId !== userId) {
        throw new ForbiddenException(
          "You do not have permission to access this document",
        );
      }
    }

    const filePath = this.storageService.getFilePath(doc.fileUrl);

    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    };
    const mimeType = mimeMap[ext] || "application/octet-stream";

    return { filePath, mimeType };
  }

  async getPublicProfileById(providerId: string) {
    return await this.redisService.getOrSet(
      `provider:profile:${providerId}`,
      async () => {
        const provider =
          await this.providerRepository.findPublicById(providerId);

        if (!provider) {
          throw new NotFoundException(
            `Provider profile with ID "${providerId}" not found`,
          );
        }
        return provider;
      },
      CACHE_TTL.PROVIDER_DETAIL,
    );
  }

  async searchPublicProviders(queryDto: QueryProviderSearchDto) {
    const version = await this.redisService.getSearchVersion();
    const cacheKey = buildNormalizedQueryKey(
      "providers:search",
      version,
      queryDto,
    );

    return await this.redisService.getOrSet(
      cacheKey,
      async () => {
        const { items, total, page, limit } =
          await this.providerRepository.findPublicProviders(queryDto);

        const formattedItems = items.map((provider) => {
          const activeServices = provider.services.map((ps) => ({
            id: ps.id,
            name: ps.service.name,
            categoryName: ps.service.category.name,
            price: Number(ps.price),
          }));

          const prices = activeServices.map((s) => s.price);
          const startingPrice = prices.length > 0 ? Math.min(...prices) : null;
          const primaryCity = provider.locations[0]?.city || null;

          return {
            providerId: provider.id,
            businessName: provider.businessName,
            profileImage: provider.profileImageUrl,
            city: primaryCity,
            averageRating: provider.averageRating,
            totalReviews: provider.totalReviews,
            startingPrice,
            services: activeServices,
          };
        });

        if (queryDto.sort === ProviderSearchSort.PRICE_ASC) {
          formattedItems.sort(
            (a, b) =>
              (a.startingPrice ?? Infinity) - (b.startingPrice ?? Infinity),
          );
        } else if (queryDto.sort === ProviderSearchSort.PRICE_DESC) {
          formattedItems.sort(
            (a, b) =>
              (b.startingPrice ?? -Infinity) - (a.startingPrice ?? -Infinity),
          );
        }

        const result = {
          items: formattedItems,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };

        return result;
      },
      CACHE_TTL.SEARCH_RESULTS,
    );
  }
}

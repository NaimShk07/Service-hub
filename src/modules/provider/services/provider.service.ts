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
import {
  ProviderSearchSort,
  QueryProviderSearchDto,
} from "../dto/query-provider-search.dto";
import { RedisService } from "@common/cache/redis.service";
import { buildNormalizedQueryKey } from "@common/utils/cache-key-builder.util";

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
    await this.redisService.delByPattern("providers:search:*");
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
    const cached = await this.redisService.get(
      `provider:profile:${providerId}`,
    );
    if (cached) {
      return cached;
    }

    const provider = await this.providerRepository.findPublicById(providerId);

    if (!provider) {
      throw new NotFoundException(
        `Provider profile with ID "${providerId}" not found`,
      );
    }

    await this.redisService.set(
      `provider:profile:${providerId}`,
      provider,
      900,
    );

    return provider;
  }

  async searchPublicProviders(queryDto: QueryProviderSearchDto) {
    const cacheKey = buildNormalizedQueryKey("providers:search", queryDto);

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

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
        (a, b) => (a.startingPrice ?? Infinity) - (b.startingPrice ?? Infinity),
      );
    } else if (queryDto.sort === ProviderSearchSort.PRICE_DESC) {
      formattedItems.sort(
        (a, b) =>
          (b.startingPrice ?? -Infinity) - (a.startingPrice ?? -Infinity),
      );
    }

    const result = {
      success: true,
      data: {
        items: formattedItems,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };

    await this.redisService.set(cacheKey, result, 300);

    return result;
  }
}

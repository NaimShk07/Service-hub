import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ServiceRepository } from "../repositories/service.repository";
import { UpdateServiceDto } from "../dto/service/update-service.dto";
import { QueryServiceDto } from "../dto/service/query-service.dto";
import { CategoryRepository } from "../repositories/category.repository";
import { CreateServiceDto } from "../dto/service/create-service.dto";
import { generateSlug } from "@common/utils/slug.util";
import { RedisService } from "@common/cache/redis.service";
import { CACHE_TTL } from "@common/constants/cache-ttl.constant";

@Injectable()
export class ServiceService {
  private readonly logger = new Logger(ServiceService.name);

  constructor(
    private readonly serviceRepository: ServiceRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateServiceDto) {
    this.logger.log(
      `Creating service "${dto.name}" in category "${dto.categoryId}"`,
    );
    const category = await this.categoryRepository.findById(dto.categoryId);

    if (!category) {
      this.logger.warn(`Category with ID "${dto.categoryId}" not found`);
      throw new NotFoundException(
        `Category with ID "${dto.categoryId}" not found`,
      );
    }

    const isUnique = await this.serviceRepository.findByNameAndCategory(
      dto.categoryId,
      dto.name,
    );

    if (isUnique) {
      this.logger.warn(
        `Service name "${dto.name}" already exists in category "${dto.categoryId}"`,
      );
      throw new ConflictException(
        "Service name already exists in this category",
      );
    }

    const slug = generateSlug(dto.name);
    const service = await this.serviceRepository.create({ ...dto, slug });
    this.logger.log(
      `Successfully created service "${service.name}" (${service.id})`,
    );
    await this.redisService.del("services:all");
    return service;
  }

  async findAll(queryDto: QueryServiceDto) {
    return await this.redisService.getOrSet(
      "services:all",
      () => this.serviceRepository.findAllPaginated(queryDto),
      CACHE_TTL.SERVICES,
    );
  }

  async findOne(id: string) {
    const service = await this.serviceRepository.findById(id);

    if (!service) {
      this.logger.warn(`Service with ID "${id}" not found`);
      throw new NotFoundException(`Service with ID "${id}" not found`);
    }

    return service;
  }

  async update(id: string, dto: UpdateServiceDto) {
    this.logger.log(`Updating service "${id}"`);
    const currentService = await this.findOne(id);

    const targetCategoryId = dto.categoryId || currentService.categoryId;

    if (dto.categoryId) {
      const category = await this.categoryRepository.findById(dto.categoryId);

      if (!category) {
        this.logger.warn(`Target category ID "${dto.categoryId}" not found`);
        throw new NotFoundException(
          `Category with ID "${dto.categoryId}" not found`,
        );
      }
    }

    let slug: string | undefined;

    if (dto.name) {
      const isSlugExist = await this.serviceRepository.findByNameAndCategory(
        targetCategoryId,
        dto.name,
      );

      if (isSlugExist && id !== isSlugExist.id) {
        this.logger.warn(
          `Service name "${dto.name}" already exists in category "${targetCategoryId}"`,
        );
        throw new ConflictException(
          "Service name already exists in this category",
        );
      }
      slug = generateSlug(dto.name);
    }

    const updated = await this.serviceRepository.update(id, {
      ...dto,
      ...(slug && { slug }),
    });
    this.logger.log(`Successfully updated service "${id}"`);
    await this.redisService.del("services:all");
    return updated;
  }

  async remove(id: string) {
    this.logger.log(`Deleting service "${id}"`);
    await this.findOne(id);
    const hasProvider = await this.serviceRepository.hasProvider(id);

    if (hasProvider) {
      this.logger.warn(
        `Cannot delete service "${id}" because active provider offerings exist`,
      );
      throw new ConflictException(
        "Cannot delete service because providers are currently offering it",
      );
    }

    const result = await this.serviceRepository.delete(id);
    this.logger.log(`Successfully deleted service "${id}"`);
    await this.redisService.del("services:all");
    return result;
  }
}

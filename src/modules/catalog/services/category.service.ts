import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { CategoryRepository } from "../repositories/category.repository";
import { CreateCategoryDto } from "../dto/category/create-category.dto";
import { UpdateCategoryDto } from "../dto/category/update-category.dto";
import { QueryCategoryDto } from "../dto/category/query-category.dto";
import { generateSlug } from "@common/utils/slug.util";
import { RedisService } from "@common/cache/redis.service";
import { CACHE_TTL } from "@common/constants/cache-ttl.constant";

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly redisService: RedisService,
  ) {}

  async findAll(queryDto: QueryCategoryDto) {
    return await this.redisService.getOrSet(
      "categories:all",
      () => this.categoryRepository.findAllPaginated(queryDto),
      CACHE_TTL.CATEGORIES,
    );
  }

  async findOne(id: string) {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      this.logger.warn(`Category with ID "${id}" not found`);
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    this.logger.log(`Creating category "${dto.name}"`);
    const slug = generateSlug(dto.name);
    const isSlugExist = await this.categoryRepository.findBySlug(slug);

    if (isSlugExist) {
      this.logger.warn(`Category name "${dto.name}" already exists`);
      throw new ConflictException(`Category name "${dto.name}" already exists`);
    }

    const category = await this.categoryRepository.create({ ...dto, slug });
    this.logger.log(
      `Successfully created category "${category.name}" (${category.id})`,
    );
    await this.redisService.del("categories:all");
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    this.logger.log(`Updating category "${id}"`);
    await this.findOne(id);

    let slug: string | undefined;

    if (dto.name) {
      slug = generateSlug(dto.name);
      const isSlugExist = await this.categoryRepository.findBySlug(slug);

      if (isSlugExist && isSlugExist.id !== id) {
        this.logger.warn(`Category name "${dto.name}" already exists`);
        throw new ConflictException(
          `Category name "${dto.name}" already exists`,
        );
      }
    }

    const updated = await this.categoryRepository.update(id, {
      ...dto,
      ...(slug && { slug }),
    });
    this.logger.log(`Successfully updated category "${id}"`);
    await this.redisService.del("categories:all");
    return updated;
  }

  async remove(id: string) {
    this.logger.log(`Deleting category "${id}"`);
    await this.findOne(id);
    const hasServices = await this.categoryRepository.hasService(id);

    if (hasServices) {
      this.logger.warn(
        `Cannot delete category "${id}" because services are attached to it`,
      );
      throw new ConflictException(
        "Cannot delete category with services attached to it",
      );
    }
    const result = await this.categoryRepository.delete(id);
    this.logger.log(`Successfully deleted category "${id}"`);
    await this.redisService.del("categories:all");
    return result;
  }
}

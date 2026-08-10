import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ServiceRepository } from "../repositories/service.repository";
import { UpdateServiceDto } from "../dto/service/update-service.dto";
import { QueryServiceDto } from "../dto/service/query-service.dto";
import { CategoryRepository } from "../repositories/category.repository";
import { CreateServiceDto } from "../dto/service/create-service.dto";
import { generateSlug } from "@common/utils/slug.util";

@Injectable()
export class ServiceService {
  constructor(
    private readonly serviceRepository: ServiceRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async create(dto: CreateServiceDto) {
    const category = await this.categoryRepository.findById(dto.categoryId);

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    const isUnique = await this.serviceRepository.findByNameAndCategory(
      dto.categoryId,
      dto.name,
    );

    if (isUnique) {
      throw new ConflictException(
        "Service name already exist in this category",
      );
    }

    const slug = generateSlug(dto.name);

    return await this.serviceRepository.create({ ...dto, slug });
  }

  async findAll(queryDto: QueryServiceDto) {
    return await this.serviceRepository.findAllPaginated(queryDto);
  }

  async findOne(id: string) {
    const service = await this.serviceRepository.findById(id);

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    return service;
  }

  async update(id: string, dto: UpdateServiceDto) {
    const currentService = await this.findOne(id);

    const targetCategoryId = dto.categoryId || currentService.categoryId;

    if (dto.categoryId) {
      const category = await this.categoryRepository.findById(dto.categoryId);

      if (!category) {
        throw new NotFoundException("Category id not found");
      }
    }

    let slug: string | undefined;

    if (dto.name) {
      const isSlugExist = await this.serviceRepository.findByNameAndCategory(
        targetCategoryId,
        dto.name,
      );

      if (isSlugExist && id !== isSlugExist.id) {
        throw new ConflictException(
          "Service name already exist in this category",
        );
      }
      slug = generateSlug(dto.name);
    }

    return await this.serviceRepository.update(id, {
      ...dto,
      ...(slug && { slug }),
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const hasProvider = await this.serviceRepository.hasProvider(id);

    if (hasProvider) {
      throw new ConflictException(
        "Cannot delete service because providers are currently offering it",
      );
    }

    return this.serviceRepository.delete(id);
  }
}

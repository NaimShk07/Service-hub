import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CategoryRepository } from "../repositories/category.repository";
import { CreateCategoryDto } from "../dto/category/create-category.dto";
import { UpdateCategoryDto } from "../dto/category/update-category.dto";
import { QueryCategoryDto } from "../dto/category/query-category.dto";
import { generateSlug } from "@common/utils/slug.util";

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async findAll(queryDto: QueryCategoryDto) {
    return await this.categoryRepository.findAllPaginated(queryDto);
  }

  async findOne(id: string) {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const slug = generateSlug(dto.name);
    const isSlugExist = await this.categoryRepository.findBySlug(slug);

    if (isSlugExist) {
      throw new ConflictException("Category name already exists");
    }

    return await this.categoryRepository.create({ ...dto, slug });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);

    let slug: string | undefined;

    if (dto.name) {
      slug = generateSlug(dto.name);
      const isSlugExist = await this.categoryRepository.findBySlug(slug);

      if (isSlugExist && isSlugExist.id !== id) {
        throw new ConflictException("Category name already exists");
      }
    }

    return await this.categoryRepository.update(id, {
      ...dto,
      ...(slug && { slug }),
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // TODO: Check if category has dependent services associated before hard deleting.

    return await this.categoryRepository.delete(id);
  }
}

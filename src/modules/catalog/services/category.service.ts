import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CategoryRepository } from "../repositories/category.repository";
import { CreateCategoryDto } from "../dto/category/create-category.dto";
import { UpdateCategoryDto } from "../dto/category/update-category.dto";

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async findAll(page: number, limit: number, includeInactive: boolean = false) {
    return await this.categoryRepository.findAllPaginated(
      page,
      limit,
      includeInactive,
    );
  }

  async findOne(id: string) {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async create(createCategoryDto: CreateCategoryDto) {
    const slug = this.generateSlug(createCategoryDto.name);
    const isSlugExist = await this.categoryRepository.findBySlug(slug);

    if (isSlugExist) {
      throw new ConflictException("Category name already exists");
    }

    return await this.categoryRepository.create({ ...createCategoryDto, slug });
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(id);

    let slug: string | undefined;

    if (updateCategoryDto.name) {
      slug = this.generateSlug(updateCategoryDto.name);
      const isSlugExist = await this.categoryRepository.findBySlug(slug);

      if (isSlugExist && isSlugExist.id !== id) {
        throw new ConflictException("Category name already exists");
      }
    }

    return await this.categoryRepository.update(id, {
      ...updateCategoryDto,
      ...(slug && { slug }),
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // TODO: Check if category has dependent services associated before hard deleting.

    return await this.categoryRepository.delete(id);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove non-alphanumeric characters except space & hyphen
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-"); // Collapse multiple hyphens
  }
}

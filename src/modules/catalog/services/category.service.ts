import { ConflictException, Injectable } from "@nestjs/common";
import { CategoryRepository } from "../repositories/category.repository";
import { CreateCategoryDto } from "../dto/category/create-category.dto";
import { UpdateCategoryDto } from "../dto/category/update-category.dto";

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async findAll() {
    return await this.categoryRepository.findAll();
  }

  async findOne(id: string) {
    return await this.categoryRepository.findById(id);
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
    const isCategoryExist = await this.findOne(id);

    if (!isCategoryExist) {
      throw new ConflictException("Category don't exists");
    }

    if (updateCategoryDto.name) {
      const slug = this.generateSlug(updateCategoryDto.name);

      const isSlugExist = await this.categoryRepository.findBySlug(slug);

      if (isSlugExist) {
        throw new ConflictException("Category name already exists");
      }
      return await this.categoryRepository.update(id, {
        ...updateCategoryDto,
        slug,
      });
    }
  }

  async remove(id: string) {
    const isCategoryExist = await this.findOne(id);

    if (!isCategoryExist) {
      throw new ConflictException("Category don't exists");
    }
    // TODO: Check if category has dependent services associated before hard deleting.

    return await this.categoryRepository.delete(id);
  }

  private generateSlug(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "-");
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CategoryService } from "../services/category.service";
import { CreateCategoryDto } from "../dto/category/create-category.dto";
import { UpdateCategoryDto } from "../dto/category/update-category.dto";
import { Role } from "@prisma-client/enums";
import { QueryCategoryDto } from "../dto/category/query-category.dto";
import { Auth } from "@common/decorators/auth.decorator";

@ApiTags("Categories")
@Controller("categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * Get all categories
   */
  @Get()
  async findAll(@Query() queryDto: QueryCategoryDto) {
    return this.categoryService.findAll(queryDto);
  }

  /**
   * Get category by ID
   */
  @Get(":id")
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.categoryService.findOne(id);
  }

  /**
   * Create a category (Admin only)
   */
  @Post()
  @Auth(Role.ADMIN)
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  /**
   * Update a category (Admin only)
   */
  @Patch(":id")
  @Auth(Role.ADMIN)
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  /**
   * Delete a category (Admin only)
   */
  @Delete(":id")
  @Auth(Role.ADMIN)
  async remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.categoryService.remove(id);
  }
}

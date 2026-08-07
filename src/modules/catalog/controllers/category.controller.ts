import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CategoryService } from "../services/category.service";
import { CreateCategoryDto } from "../dto/category/create-category.dto";
import { UpdateCategoryDto } from "../dto/category/update-category.dto";

@Controller("categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  findAll() {}

  @Get(":id")
  findOne(@Param("id") id: string) {}

  @Post()
  create(@Body() dto: CreateCategoryDto) {}

  @Patch("id")
  update(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {}

  @Delete("id")
  delete(@Param("id") id: string) {}
}

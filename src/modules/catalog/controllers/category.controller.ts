import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { CategoryService } from "../services/category.service";
import { CreateCategoryDto } from "../dto/category/create-category.dto";
import { UpdateCategoryDto } from "../dto/category/update-category.dto";
import { Roles } from "@common/decorators/roles.decorator";
import { Role } from "@prisma-client/enums";
import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { RoleGuard } from "@modules/auth/guards/roles.guard";

@ApiTags("Categories")
@Controller("categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: "Get all categories" })
  async findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("includeInactive", new DefaultValuePipe(false), ParseBoolPipe)
    includeInactive: boolean,
  ) {
    return this.categoryService.findAll(page, limit, includeInactive);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get category by ID" })
  @ApiParam({ name: "id", description: "Category ID" })
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.categoryService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a category" })
  @ApiBody({ type: CreateCategoryDto })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a category" })
  @ApiParam({ name: "id", description: "Category ID" })
  @ApiBody({ type: UpdateCategoryDto })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a category" })
  @ApiParam({ name: "id", description: "Category ID" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.categoryService.remove(id);
  }
}

import { PrismaService } from "@database/prisma/prisma.service";
import { BaseRepository } from "@database/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma-client/client";
import { QueryCategoryDto } from "../dto/category/query-category.dto";

@Injectable()
export class CategoryRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAllPaginated(queryDto: QueryCategoryDto) {
    const { page = 1, limit = 10, includeInactive = false, search } = queryDto;
    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = includeInactive
      ? {}
      : { isActive: true };

    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    const query = this.prisma.category.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    });

    const total = this.prisma.category.count({
      where,
    });

    return this.paginate(query, total, page, limit);
  }

  async findById(id: string) {
    return await this.prisma.category.findUnique({ where: { id } });
  }

  async findBySlug(slug: string) {
    return await this.prisma.category.findUnique({ where: { slug } });
  }

  async create(data: Prisma.CategoryCreateInput) {
    return await this.prisma.category.create({ data });
  }

  async update(id: string, data: Prisma.CategoryUpdateInput) {
    return await this.prisma.category.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async hasService(categoryId: string) {
    const count = await this.prisma.service.count({
      where: {
        categoryId,
        isActive: true,
      },
    });

    return count > 0;
  }
}

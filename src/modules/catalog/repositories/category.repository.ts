import { PrismaService } from "@database/prisma/prisma.service";
import { BaseRepository } from "@database/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma-client/client";

@Injectable()
export class CategoryRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAll() {
    return await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });
  }

  async findAllPaginated(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const query = this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      skip,
      take: limit,
    });

    const total = this.prisma.category.count({
      where: { isActive: true },
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
}

import { PrismaService } from "@database/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma-client/client";

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });
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
    return await this.prisma.category.delete({ where: { id } });
  }
}

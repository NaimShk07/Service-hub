import { PrismaService } from "@database/prisma/prisma.service";
import { BaseRepository } from "@database/repositories/base.repository";
import { QueryServiceDto } from "../dto/service/query-service.dto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma-client/client";

@Injectable()
export class ServiceRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAllPaginated(queryDto: QueryServiceDto) {
    const { page = 1, limit = 10, search, categoryId } = queryDto;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ServiceWhereInput = { isActive: true };

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    if (search) {
      whereClause.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    const query = this.prisma.service.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    const total = this.prisma.service.count({
      where: whereClause,
    });

    return this.paginate(query, total, page, limit);
  }

  async findById(id: string) {
    return await this.prisma.service.findUnique({
      where: { id },
      include: { category: true },
    });
  }

  async findByNameAndCategory(categoryId: string, name: string) {
    return await this.prisma.service.findFirst({
      where: { categoryId, name },
    });
  }

  async findBySlug(slug: string) {
    return await this.prisma.service.findFirst({
      where: { slug },
    });
  }

  async create(data: Prisma.ServiceUncheckedCreateInput) {
    return await this.prisma.service.create({ data });
  }

  async update(id: string, data: Prisma.ServiceUpdateInput) {
    return await this.prisma.service.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async hasProvider(serviceId: string) {
    const count = await this.prisma.providerService.count({
      where: {
        serviceId,
        isActive: true,
      },
    });

    return count > 0;
  }
}

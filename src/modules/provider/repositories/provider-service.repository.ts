import { PrismaService } from "@database/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { CreateProviderServiceDto } from "../dto/create-provider-service.dto";
import { UpdateProviderServiceDto } from "../dto/update-provider-service.dto";
import { QueryPublicProviderServicesDto } from "../dto/query-public-provider-service.dto";
import { BaseRepository } from "@database/repositories/base.repository";
import { Prisma } from "@prisma-client/client";

@Injectable()
export class ProviderServiceRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByProviderId(providerId: string) {
    return await this.prisma.providerService.findMany({
      where: { providerId },
      include: { service: { include: { category: true } } },
    });
  }

  async findById(id: string) {
    return await this.prisma.providerService.findUnique({
      where: { id },
      include: {
        provider: { include: { user: true } },
        service: { include: { category: true } },
      },
    });
  }

  async findByProviderAndServiceId(providerId: string, serviceId: string) {
    return await this.prisma.providerService.findUnique({
      where: { providerId_serviceId: { providerId, serviceId } },
    });
  }

  async create(providerId: string, dto: CreateProviderServiceDto) {
    return await this.prisma.providerService.create({
      data: {
        providerId,
        ...dto,
      },
    });
  }

  async update(id: string, dto: UpdateProviderServiceDto) {
    return await this.prisma.providerService.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string) {
    return await this.prisma.providerService.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  async findPublicProviderService(
    providerId: string,
    queryDto: QueryPublicProviderServicesDto,
  ) {
    const { categoryId, serviceMode, search, page = 1, limit = 10 } = queryDto;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ProviderServiceWhereInput = {
      providerId,
      isActive: true,

      service: {
        isActive: true,
        ...(categoryId && { categoryId }),
        ...(serviceMode && { serviceMode }),
        ...(search && { name: { contains: search, mode: "insensitive" } }),
      },
    };

    const query = this.prisma.providerService.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    const total = this.prisma.providerService.count({
      where: whereClause,
    });

    return this.paginate(query, total, page, limit);
  }
}

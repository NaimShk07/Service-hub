import { PrismaService } from "@database/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { CreateProviderServiceDto } from "../dto/create-provider-service.dto";
import { UpdateProviderServiceDto } from "../dto/update-provider-service.dto";

@Injectable()
export class ProviderServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProviderId(providerId: string) {
    return await this.prisma.providerService.findMany({
      where: { providerId },
      include: { service: { include: { category: true } } },
    });
  }

  async findById(id: string) {
    return await this.prisma.providerService.findUnique({
      where: { id },
      include: { service: { include: { category: true } } },
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
}

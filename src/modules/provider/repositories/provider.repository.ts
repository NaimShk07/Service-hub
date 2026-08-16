import { PrismaService } from "@database/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { CreateProviderDto } from "../dto/create-provider.dto";
import { UpdateProviderDto } from "../dto/update-provider.dto";

@Injectable()
export class ProviderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string) {
    return await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: {
        locations: true,
        documents: true,
      },
    });
  }

  async findByBusinessName(businessName: string) {
    return await this.prisma.providerProfile.findFirst({
      where: { businessName: { equals: businessName, mode: "insensitive" } },
    });
  }

  async findById(id: string) {
    return await this.prisma.providerProfile.findUnique({
      where: { id },
      include: {
        locations: true,
        user: {
          select: { email: true, phone: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async create(userId: string, dto: CreateProviderDto) {
    return await this.prisma.providerProfile.create({
      data: {
        user: { connect: { id: userId } },
        businessName: dto.businessName,
        description: dto.description,
        experienceYears: dto.experienceYears,
        profileImageUrl: dto.profileImageUrl,
        locations: {
          create: [
            {
              addressLine1: dto.addressLine1,
              addressLine2: dto.addressLine2,
              city: dto.city,
              state: dto.state,
              postalCode: dto.postalCode,
              isPrimary: true,
            },
          ],
        },
      },
      include: {
        locations: true,
      },
    });
  }

  async update(providerId: string, data: UpdateProviderDto) {
    const {
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      ...profileData
    } = data;

    const hasLocationFields =
      addressLine1 || addressLine2 || city || state || postalCode;

    return await this.prisma.providerProfile.update({
      where: { id: providerId },
      data: {
        ...profileData,
        ...(hasLocationFields && {
          locations: {
            updateMany: {
              where: { isPrimary: true },
              data: {
                ...(addressLine1 && { addressLine1 }),
                ...(addressLine2 && { addressLine2 }),
                ...(city && { city }),
                ...(state && { state }),
                ...(postalCode && { postalCode }),
              },
            },
          },
        }),
      },
      include: {
        locations: true,
      },
    });
  }

  async findPublicById(providerId: string) {
    return await this.prisma.providerProfile.findUnique({
      where: { id: providerId },
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
        locations: true,
        services: {
          where: { isActive: true },
          include: {
            service: {
              select: {
                id: true,
                name: true,
                slug: true,
                serviceMode: true,
                category: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        },
      },
    });
  }
}

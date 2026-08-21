import { PrismaService } from "@database/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { CreateProviderDto } from "../dto/create-provider.dto";
import { UpdateProviderDto } from "../dto/update-provider.dto";
import {
  ProviderSearchSort,
  QueryProviderSearchDto,
} from "../dto/query-provider-search.dto";
import { VerificationStatus } from "@prisma-client/enums";
import { Prisma } from "@prisma-client/client";
import { BaseRepository } from "@database/repositories/base.repository";

@Injectable()
export class ProviderRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

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

  async findPublicProviders(queryDto: QueryProviderSearchDto) {
    const {
      categoryId,
      serviceId,
      city,
      minPrice,
      maxPrice,
      minRating,
      search,
      sort,
      page = 1,
      limit = 20,
    } = queryDto;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ProviderProfileWhereInput = {
      verificationStatus: VerificationStatus.VERIFIED,

      // 1. Min Rating Filter
      ...(minRating !== undefined && { averageRating: { gte: minRating } }),

      // 2. City Filter
      ...(city && {
        locations: {
          some: {
            city: { equals: city, mode: "insensitive" },
          },
        },
      }),

      // 3. Nested Service, Category & Price Filters
      ...((categoryId ||
        serviceId ||
        minPrice !== undefined ||
        maxPrice !== undefined) && {
        services: {
          some: {
            isActive: true,
            ...(serviceId && { serviceId }),
            ...(categoryId && { service: { categoryId } }),
            ...((minPrice !== undefined || maxPrice !== undefined) && {
              price: {
                ...(minPrice !== undefined && { gte: minPrice }),
                ...(maxPrice !== undefined && { lte: maxPrice }),
              },
            }),
          },
        },
      }),

      ...(search && {
        OR: [
          { businessName: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          {
            services: {
              some: {
                isActive: true,
                service: {
                  name: { contains: search, mode: "insensitive" },
                },
              },
            },
          },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.providerProfile.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          locations: {
            where: { isPrimary: true },
          },
          services: {
            where: { isActive: true },
            include: {
              service: {
                select: {
                  name: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: this.buildOrderBy(sort),
      }),
      this.prisma.providerProfile.count({ where: whereClause }),
    ]);

    return { items, total, page, limit };
  }

  private buildOrderBy(
    sort?: ProviderSearchSort,
  ): Prisma.ProviderProfileOrderByWithRelationInput[] {
    switch (sort) {
      case ProviderSearchSort.RATING_ASC:
        return [{ averageRating: "asc" }];
      case ProviderSearchSort.NEWEST:
        return [{ createdAt: "desc" }];

      case ProviderSearchSort.RATING_DESC:
      default:
        return [{ averageRating: "desc" }];
    }
  }
}

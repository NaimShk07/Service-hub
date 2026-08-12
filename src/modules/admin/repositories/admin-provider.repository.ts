import { BaseRepository } from "@database/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { VerificationStatus } from "@prisma-client/client";
import { QueryAdminProviderDto } from "../dto/query-admin-provider.dto";
import { PrismaService } from "@database/prisma/prisma.service";

@Injectable()
export class AdminProviderRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAllPaginated(queryDto: QueryAdminProviderDto) {
    const { status, search, page = 1, limit = 10 } = queryDto;
    const skip = (page - 1) * limit;

    const whereClause = {
      ...(status && { verificationStatus: status }),
      ...(search && {
        businessName: {
          contains: search,
          mode: "insensitive" as const,
        },
      }),
    };

    const query = this.prisma.providerProfile.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        locations: true,
      },
    });

    const total = this.prisma.providerProfile.count({
      where: whereClause,
    });

    return this.paginate(query, total, page, limit);
  }

  async findById(id: string) {
    return await this.prisma.providerProfile.findUnique({
      where: {
        id,
      },
      include: {
        user: true,
        locations: true,
        documents: true,
      },
    });
  }

  async updateVerificationStatus(
    id: string,
    status: VerificationStatus,
    rejectionReason?: string,
  ) {
    const profile = this.prisma.providerProfile.update({
      where: { id },
      data: { verificationStatus: status },
    });

    if (rejectionReason) {
      await this.prisma.providerDocument.updateMany({
        where: { providerId: id },
        data: {
          rejectionReason,
        },
      });
    }

    return profile;
  }
}

import { PrismaService } from "@database/prisma/prisma.service";
import { BaseRepository } from "@database/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma-client/client";
import { QueryReviewDto } from "../dto/query-review.dto";

@Injectable()
export class ReviewRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(
    data: Prisma.ReviewUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return await client.review.create({
      data,
    });
  }

  async findById(id: string) {
    return await this.prisma.review.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findByBookingId(bookingId: string) {
    return await this.prisma.review.findUnique({
      where: { bookingId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findByProviderId(providerId: string, queryDto: QueryReviewDto) {
    const { page = 1, limit = 10, rating } = queryDto;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      providerId,
      ...(rating ? { rating } : {}),
    };

    const query = this.prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const total = this.prisma.review.count({
      where,
    });

    // Uses BaseRepository's built-in pagination standard
    return await this.paginate(query, total, page, limit);
  }

  async aggregateProviderRating(
    providerId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return await client.review.aggregate({
      where: { providerId },
      _avg: { rating: true },
      _count: { rating: true },
    });
  }

  async updateProviderRatingStats(
    providerId: string,
    averageRating: number,
    totalReviews: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return await client.providerProfile.update({
      where: { id: providerId },
      data: {
        averageRating: new Prisma.Decimal(averageRating.toFixed(2)),
        totalReviews,
      },
    });
  }
}

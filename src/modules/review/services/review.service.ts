import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@database/prisma/prisma.service";
import { ReviewRepository } from "../repositories/review.repository";
import { BookingRepository } from "@modules/booking/repositories/booking.repository";
import { CreateReviewDto } from "../dto/create-review.dto";
import { QueryReviewDto } from "../dto/query-review.dto";
import { BookingStatus } from "@prisma-client/enums";
import { UpdateReviewDto } from "../dto/update-review.dto";
import { RedisService } from "@common/cache/redis.service";

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewRepository: ReviewRepository,
    private readonly bookingRepository: BookingRepository,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Submits a trustworthy review for a completed booking.
   * Atomically recalculates provider's averageRating and totalReviews.
   */
  async createReview(
    customerId: string,
    dto: CreateReviewDto,
    pathBookingId?: string,
  ) {
    const bookingId = pathBookingId || dto.bookingId;
    if (!bookingId) {
      throw new BadRequestException(
        "bookingId must be provided in URL or body",
      );
    }

    // 1. Fetch booking via BookingRepository
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking) {
      throw new NotFoundException(`Booking "${bookingId}" not found`);
    }

    // 2. Authorization Invariant: Only the customer who booked can leave a review
    if (booking.customerId !== customerId) {
      throw new ForbiddenException(
        "You are not authorized to review a booking that does not belong to you",
      );
    }

    // 3. Lifecycle Invariant: Must be COMPLETED
    if (booking.bookingStatus !== BookingStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot review booking in "${booking.bookingStatus}" status. Booking must be COMPLETED.`,
      );
    }

    // 4. Exact-once Invariant: One review per booking
    const existingReview =
      await this.reviewRepository.findByBookingId(bookingId);
    if (existingReview) {
      throw new ConflictException(
        "A review has already been submitted for this booking",
      );
    }

    // 5. ACID Transaction: Insert review + Recalculate provider ratings atomically
    const result = await this.prisma.$transaction(async (tx) => {
      // Create Review record (enforcing derived customerId & providerId from booking)
      const review = await this.reviewRepository.create(
        {
          bookingId,
          customerId,
          providerId: booking.providerId,
          rating: dto.rating,
          comment: dto.comment?.trim() || null,
        },
        tx,
      );

      // Recalculate provider metrics
      const agg = await this.reviewRepository.aggregateProviderRating(
        booking.providerId,
        tx,
      );

      const averageRating = agg._avg.rating ?? 0;
      const totalReviews = agg._count.rating ?? 0;

      await this.reviewRepository.updateProviderRatingStats(
        booking.providerId,
        averageRating,
        totalReviews,
        tx,
      );

      this.logger.log(
        `Review created for booking ${bookingId}. Provider ${booking.providerId} updated: avgRating=${averageRating.toFixed(2)}, totalReviews=${totalReviews}`,
      );

      return {
        ...review,
        providerMetrics: {
          averageRating: parseFloat(averageRating.toFixed(2)),
          totalReviews,
        },
      };
    });

    await this.redisService.del("provider:profile:" + booking.providerId);

    return result;
  }

  async getProviderReviews(providerId: string, query: QueryReviewDto) {
    const result = await this.reviewRepository.findByProviderId(
      providerId,
      query,
    );
    return {
      items: result.data,
      data: result.data,
      meta: result.meta,
    };
  }

  /**
   * Updates an existing review submitted by the customer.
   * If rating changes, recalculates provider averageRating atomically in a transaction.
   */
  async updateReview(
    customerId: string,
    reviewId: string,
    dto: UpdateReviewDto,
  ) {
    // 1. Verify review exists
    const review = await this.reviewRepository.findById(reviewId);
    if (!review) {
      throw new NotFoundException("Review not found");
    }

    // 2. Ownership verification: Customer must own this review
    if (review.customerId !== customerId) {
      throw new ForbiddenException(
        "You are not authorized to update this review",
      );
    }

    const isRatingChanged =
      dto.rating !== undefined && dto.rating !== review.rating;

    // 3. If rating changed, update review + recalculate provider metrics in an ACID transaction
    if (isRatingChanged) {
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await this.reviewRepository.update(
          reviewId,
          {
            rating: dto.rating,
            comment:
              dto.comment !== undefined
                ? dto.comment?.trim() || null
                : undefined,
          },
          tx,
        );

        // Recalculate provider metrics
        const agg = await this.reviewRepository.aggregateProviderRating(
          review.providerId,
          tx,
        );

        const averageRating = agg._avg.rating ?? 0;
        const totalReviews = agg._count.rating ?? 0;

        await this.reviewRepository.updateProviderRatingStats(
          review.providerId,
          averageRating,
          totalReviews,
          tx,
        );

        this.logger.log(
          `Review ${reviewId} updated with new rating ${dto.rating}. Provider ${review.providerId} recalculated: avg=${averageRating.toFixed(2)}, total=${totalReviews}`,
        );

        return {
          ...updated,
          providerMetrics: {
            averageRating: parseFloat(averageRating.toFixed(2)),
            totalReviews,
          },
        };
      });

      await this.redisService.del("provider:profile:" + review.providerId);

      return result;
    }

    // 4. If only comment was updated (rating untouched)
    const updated = await this.reviewRepository.update(reviewId, {
      comment:
        dto.comment !== undefined ? dto.comment?.trim() || null : undefined,
    });
    return updated;
  }

  async getBookingReview(bookingId: string) {
    const review = await this.reviewRepository.findByBookingId(bookingId);
    if (!review) {
      throw new NotFoundException(
        `No review found for booking with ID "${bookingId}"`,
      );
    }
    return review;
  }
}

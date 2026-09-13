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

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewRepository: ReviewRepository,
    private readonly bookingRepository: BookingRepository,
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
    return await this.prisma.$transaction(async (tx) => {
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

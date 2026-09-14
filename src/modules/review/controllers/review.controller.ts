import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ReviewService } from "../services/review.service";
import { CreateReviewDto } from "../dto/create-review.dto";
import { QueryReviewDto } from "../dto/query-review.dto";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { Auth } from "@common/decorators/auth.decorator";
import { Role } from "@prisma-client/enums";
import { UpdateReviewDto } from "../dto/update-review.dto";

@ApiTags("Reviews")
@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * Submit a review for a completed booking by URL bookingId (Customer only)
   */
  @Post("bookings/:bookingId/review")
  @Auth(Role.USER)
  async createBookingReview(
    @Param("bookingId", ParseUUIDPipe) bookingId: string,
    @CurrentUser("userId") customerId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return await this.reviewService.createReview(customerId, dto, bookingId);
  }

  /**
   * Submit a review with bookingId in body (Customer only)
   */
  @Post("reviews")
  @Auth(Role.USER)
  async createReview(
    @CurrentUser("userId") customerId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return await this.reviewService.createReview(customerId, dto);
  }

  /**
   * Update customer's review for a booking
   */
  @Patch("reviews/:id")
  @Auth(Role.USER)
  async updateReview(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") customerId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return await this.reviewService.updateReview(customerId, id, dto);
  }

  /**
   * Get public paginated reviews for a provider
   */
  @Get("providers/:providerId/reviews")
  async getProviderReviews(
    @Param("providerId", ParseUUIDPipe) providerId: string,
    @Query() query: QueryReviewDto,
  ) {
    return await this.reviewService.getProviderReviews(providerId, query);
  }

  /**
   * Alias to get provider reviews
   */
  @Get("reviews/provider/:providerId")
  async getProviderReviewsAlias(
    @Param("providerId", ParseUUIDPipe) providerId: string,
    @Query() query: QueryReviewDto,
  ) {
    return await this.reviewService.getProviderReviews(providerId, query);
  }

  /**
   * Get review associated with a specific booking
   */
  @Get("reviews/booking/:bookingId")
  @Auth()
  async getBookingReview(@Param("bookingId", ParseUUIDPipe) bookingId: string) {
    return await this.reviewService.getBookingReview(bookingId);
  }
}

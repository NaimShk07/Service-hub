import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ReviewService } from "../services/review.service";
import { CreateReviewDto } from "../dto/create-review.dto";
import { QueryReviewDto } from "../dto/query-review.dto";
import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { CurrentUser } from "@common/decorators/current-user.decorator";

@ApiTags("Reviews")
@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // POST /api/v1/bookings/:bookingId/review
  @Post("bookings/:bookingId/review")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Submit a review for a completed booking by URL bookingId (Customer only)",
  })
  @ApiResponse({ status: 201, description: "Review submitted successfully" })
  @ApiResponse({ status: 400, description: "Booking is not completed" })
  @ApiResponse({ status: 403, description: "Not the customer of this booking" })
  @ApiResponse({ status: 409, description: "Review already submitted" })
  async createBookingReview(
    @Param("bookingId", ParseUUIDPipe) bookingId: string,
    @CurrentUser("userId") customerId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return await this.reviewService.createReview(customerId, dto, bookingId);
  }

  // General endpoint: POST /api/v1/reviews
  @Post("reviews")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Submit a review with bookingId in body (Customer only)",
  })
  async createReview(
    @CurrentUser("userId") customerId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return await this.reviewService.createReview(customerId, dto);
  }

  // GET /api/v1/providers/:providerId/reviews
  @Get("providers/:providerId/reviews")
  @ApiOperation({
    summary: "Get public paginated reviews for a provider",
  })
  @ApiResponse({ status: 200, description: "List of provider reviews" })
  async getProviderReviews(
    @Param("providerId", ParseUUIDPipe) providerId: string,
    @Query() query: QueryReviewDto,
  ) {
    return await this.reviewService.getProviderReviews(providerId, query);
  }

  // Alias endpoint: GET /api/v1/reviews/provider/:providerId
  @Get("reviews/provider/:providerId")
  @ApiOperation({ summary: "Alias to get provider reviews" })
  async getProviderReviewsAlias(
    @Param("providerId", ParseUUIDPipe) providerId: string,
    @Query() query: QueryReviewDto,
  ) {
    return await this.reviewService.getProviderReviews(providerId, query);
  }

  @Get("reviews/booking/:bookingId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get review associated with a specific booking" })
  @ApiResponse({ status: 200, description: "Booking review" })
  @ApiResponse({ status: 404, description: "Review not found" })
  async getBookingReview(@Param("bookingId", ParseUUIDPipe) bookingId: string) {
    return await this.reviewService.getBookingReview(bookingId);
  }
}

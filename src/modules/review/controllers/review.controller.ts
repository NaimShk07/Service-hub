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
@Controller("reviews")
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Submit a review for a completed booking (Customer only)",
  })
  @ApiResponse({ status: 201, description: "Review submitted successfully" })
  @ApiResponse({
    status: 400,
    description: "Booking is not completed or validation error",
  })
  @ApiResponse({ status: 403, description: "Not the customer of this booking" })
  @ApiResponse({
    status: 409,
    description: "Review already submitted for this booking",
  })
  async createReview(
    @CurrentUser("userId") customerId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return await this.reviewService.createReview(customerId, dto);
  }

  @Get("provider/:providerId")
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

  @Get("booking/:bookingId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get review associated with a specific booking" })
  @ApiResponse({ status: 200, description: "Booking review" })
  @ApiResponse({ status: 404, description: "Review not found" })
  async getBookingReview(@Param("bookingId", ParseUUIDPipe) bookingId: string) {
    return await this.reviewService.getBookingReview(bookingId);
  }
}

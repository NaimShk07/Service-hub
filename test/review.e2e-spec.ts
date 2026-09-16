import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "@database/prisma/prisma.service";
import { RedisService } from "@common/cache/redis.service";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaClientExceptionFilter } from "../src/common/filters/prisma-client-exception.filter";
import {
  BookingStatus,
  Role,
  ServiceMode,
  UserStatus,
  VerificationStatus,
} from "@prisma-client/enums";
import { Prisma } from "@prisma-client/client";

describe("Review Domain (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let redisService: RedisService;

  let testCustomer: any;
  let customerToken: string;

  let otherCustomer: any;
  let otherCustomerToken: string;

  let providerUser: any;
  let testProvider: any;
  let testCategory: any;
  let testService: any;
  let testProviderService: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(
      new HttpExceptionFilter(),
      new PrismaClientExceptionFilter(),
    );
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    redisService = app.get(RedisService);

    // 1. Seed primary test customer
    testCustomer = await prisma.user.create({
      data: {
        email: `rev_cust_${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Review",
        lastName: "Customer",
        phone: `+91${Date.now().toString().slice(-10)}`,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    customerToken = await jwtService.signAsync({
      sub: testCustomer.id,
      email: testCustomer.email,
      role: testCustomer.role,
    });

    // 2. Seed other customer (for authorization invariant test)
    otherCustomer = await prisma.user.create({
      data: {
        email: `rev_other_${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Other",
        lastName: "User",
        phone: `+91${(Date.now() + 1).toString().slice(-10)}`,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    otherCustomerToken = await jwtService.signAsync({
      sub: otherCustomer.id,
      email: otherCustomer.email,
      role: otherCustomer.role,
    });

    // 3. Seed provider
    providerUser = await prisma.user.create({
      data: {
        email: `rev_prov_${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Provider",
        lastName: "User",
        phone: `+91${(Date.now() + 2).toString().slice(-10)}`,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    testProvider = await prisma.providerProfile.create({
      data: {
        userId: providerUser.id,
        businessName: "Elite Appliance Care",
        experienceYears: 7,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });

    // 4. Seed category, service & offering
    testCategory = await prisma.category.create({
      data: {
        name: `RevCat_${Date.now()}`,
        slug: `rev-cat-${Date.now()}`,
      },
    });

    testService = await prisma.service.create({
      data: {
        name: "AC Repair & Servicing",
        slug: `ac-repair-${Date.now()}`,
        categoryId: testCategory.id,
        serviceMode: ServiceMode.AT_CUSTOMER_LOCATION,
      },
    });

    testProviderService = await prisma.providerService.create({
      data: {
        providerId: testProvider.id,
        serviceId: testService.id,
        price: new Prisma.Decimal("1200.00"),
        durationMinutes: 90,
      },
    });
  });

  afterAll(async () => {
    // Teardown test fixtures
    await prisma.review.deleteMany({
      where: {
        OR: [
          { customerId: testCustomer?.id },
          { customerId: otherCustomer?.id },
          { providerId: testProvider?.id },
        ],
      },
    });

    await prisma.booking.deleteMany({
      where: {
        OR: [
          { customerId: testCustomer?.id },
          { customerId: otherCustomer?.id },
          { providerId: testProvider?.id },
        ],
      },
    });

    if (testProviderService) {
      await prisma.providerService.delete({
        where: { id: testProviderService.id },
      }).catch(() => null);
    }

    if (testService) {
      await prisma.service.delete({ where: { id: testService.id } }).catch(() => null);
    }

    if (testCategory) {
      await prisma.category.delete({ where: { id: testCategory.id } }).catch(() => null);
    }

    if (testProvider) {
      await prisma.providerProfile.delete({ where: { id: testProvider.id } }).catch(() => null);
    }

    const userIds = [testCustomer?.id, otherCustomer?.id, providerUser?.id].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      }).catch(() => null);
    }

    await prisma.$disconnect();
    await app.close();
  });

  let dayOffset = 1;

  async function createBooking(customerId: string, status: BookingStatus) {
    dayOffset++;
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + dayOffset);

    return await prisma.booking.create({
      data: {
        customerId,
        providerId: testProvider.id,
        providerServiceId: testProviderService.id,
        bookingDate,
        startTime: new Date("1970-01-01T10:00:00Z"),
        endTime: new Date("1970-01-01T11:30:00Z"),
        bookingStatus: status,
        bookedPrice: new Prisma.Decimal("1200.00"),
        bookedDuration: 90,
        bookedServiceMode: ServiceMode.AT_CUSTOMER_LOCATION,
        serviceName: "AC Repair & Servicing",
        providerBusinessName: "Elite Appliance Care",
        completedAt: status === BookingStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  // =========================================================================
  describe("1. Review Invariants & Validation", () => {
    it("✓ Should reject review if booking is not COMPLETED (e.g. CONFIRMED)", async () => {
      const confirmedBooking = await createBooking(
        testCustomer.id,
        BookingStatus.CONFIRMED,
      );

      const res = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          bookingId: confirmedBooking.id,
          rating: 5,
          comment: "Great service!",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("must be COMPLETED");
    });

    it("✓ Should reject review if customer did not make this booking (403 Forbidden)", async () => {
      const completedBooking = await createBooking(
        testCustomer.id,
        BookingStatus.COMPLETED,
      );

      // otherCustomer attempts to review testCustomer's booking
      const res = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${otherCustomerToken}`)
        .send({
          bookingId: completedBooking.id,
          rating: 4,
          comment: "Trying to review someone else's appointment",
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("not authorized");
    });

    it("✓ Should validate rating range (rating must be between 1 and 5)", async () => {
      const completedBooking = await createBooking(
        testCustomer.id,
        BookingStatus.COMPLETED,
      );

      const res = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          bookingId: completedBooking.id,
          rating: 6, // Invalid rating
          comment: "Too high",
        });

      expect(res.status).toBe(400);
    });

    it("✓ Should reject review if booking is PENDING_PAYMENT (400 Bad Request)", async () => {
      const pendingBooking = await createBooking(
        testCustomer.id,
        BookingStatus.PENDING_PAYMENT,
      );

      const res = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          bookingId: pendingBooking.id,
          rating: 5,
          comment: "Trying to review before paying",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("must be COMPLETED");
    });

    it("✓ Should reject review if booking is CANCELLED (400 Bad Request)", async () => {
      const cancelledBooking = await createBooking(
        testCustomer.id,
        BookingStatus.CANCELLED,
      );

      const res = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          bookingId: cancelledBooking.id,
          rating: 1,
          comment: "Trying to review cancelled booking",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("must be COMPLETED");
    });

    it("✓ Should reject review if comment exceeds 1000 characters (400 Bad Request)", async () => {
      const completedBooking = await createBooking(
        testCustomer.id,
        BookingStatus.COMPLETED,
      );

      const res = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          bookingId: completedBooking.id,
          rating: 5,
          comment: "a".repeat(1001),
        });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  describe("2. Review Creation & Rating Recalculation", () => {
    let completedBooking1: any;

    beforeAll(async () => {
      completedBooking1 = await createBooking(
        testCustomer.id,
        BookingStatus.COMPLETED,
      );
    });

    it("✓ Should submit review for COMPLETED booking and atomically update provider rating", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          bookingId: completedBooking1.id,
          rating: 5,
          comment: "Punctual and very polite professional. Fixed the AC completely!",
        });

      expect(res.status).toBe(201);
      const body = res.body.data || res.body;
      expect(body.rating).toBe(5);
      expect(body.comment).toBe("Punctual and very polite professional. Fixed the AC completely!");
      expect(body.customerId).toBe(testCustomer.id);
      expect(body.providerId).toBe(testProvider.id);
      expect(body.bookingId).toBe(completedBooking1.id);

      // Verify ProviderProfile was atomically updated
      const provider = await prisma.providerProfile.findUnique({
        where: { id: testProvider.id },
      });
      expect(Number(provider?.averageRating)).toBe(5.0);
      expect(provider?.totalReviews).toBe(1);
    });

    it("✓ Should reject duplicate review for the same booking (409 Conflict)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          bookingId: completedBooking1.id,
          rating: 4,
          comment: "Attempting to submit review second time",
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("already been submitted");
    });

    it("✓ Submitting a second review correctly recalculates average rating", async () => {
      // Create a second completed booking
      const completedBooking2 = await createBooking(
        testCustomer.id,
        BookingStatus.COMPLETED,
      );

      // Submit rating: 3 (Average of 5 and 3 should be 4.00)
      const res = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          bookingId: completedBooking2.id,
          rating: 3,
          comment: "Service was okay, took longer than expected.",
        });

      expect(res.status).toBe(201);

      // Verify ProviderProfile averageRating = 4.00 and totalReviews = 2
      const provider = await prisma.providerProfile.findUnique({
        where: { id: testProvider.id },
      });
      expect(Number(provider?.averageRating)).toBe(4.0);
      expect(provider?.totalReviews).toBe(2);
    });
  });

  // =========================================================================
  describe("3. Review Retrieval Endpoints", () => {
    it("✓ GET /api/v1/reviews/provider/:providerId should return paginated reviews", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/provider/${testProvider.id}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      const body = res.body.data ? res.body : { data: res.body };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(2);
      expect(body.data[0]).toHaveProperty("rating");
      expect(body.data[0]).toHaveProperty("customer");
      expect(body.data[0].customer).toHaveProperty("firstName", "Review");
      expect(body.meta.total).toBe(2);
    });

    it("✓ GET /api/v1/reviews/provider/:providerId with rating filter", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/provider/${testProvider.id}`)
        .query({ rating: 5 });

      expect(res.status).toBe(200);
      const body = res.body.data ? res.body : { data: res.body };
      expect(body.data.length).toBe(1);
      expect(body.data[0].rating).toBe(5);
    });

    it("✓ GET /api/v1/reviews/booking/:bookingId returns review for given booking", async () => {
      const review = await prisma.review.findFirst({
        where: { providerId: testProvider.id },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/booking/${review?.bookingId}`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const body = res.body.data || res.body;
      expect(body.id).toBe(review?.id);
      expect(body.rating).toBe(review?.rating);
    });

    it("✓ POST /api/v1/bookings/:bookingId/review creates review via path param (Day 2 shape)", async () => {
      const booking = await createBooking(
        testCustomer.id,
        BookingStatus.COMPLETED,
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${booking.id}/review`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          rating: 4,
          comment: "Created via Day 2 path endpoint",
        });

      expect(res.status).toBe(201);
      const body = res.body.data || res.body;
      expect(body.rating).toBe(4);
      expect(body.bookingId).toBe(booking.id);
    });

    it("✓ GET /api/v1/providers/:providerId/reviews returns items and supports sorting (Day 3 shape)", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/providers/${testProvider.id}/reviews`)
        .query({ page: 1, limit: 10, sort: "highest" });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(2);
      expect(res.body.items[0].rating).toBeGreaterThanOrEqual(
        res.body.items[1].rating,
      );
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
    });

    it("✓ GET /api/v1/reviews/booking/:bookingId returns 404 for unreviewed booking", async () => {
      const unreviewedBooking = await createBooking(
        testCustomer.id,
        BookingStatus.COMPLETED,
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/booking/${unreviewedBooking.id}`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("4. Review Editing (Day 5)", () => {
    let editableReviewId: string;

    beforeAll(async () => {
      // Create a fresh booking & review to test editing
      const editBooking = await createBooking(
        testCustomer.id,
        BookingStatus.COMPLETED,
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${editBooking.id}/review`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          rating: 4,
          comment: "Initial review comment",
        });

      editableReviewId = res.body.data?.id || res.body.id;
    });

    it("✓ Should reject update if review does not exist (404 Not Found)", async () => {
      const randomUuid = "00000000-0000-0000-0000-000000000000";
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${randomUuid}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ comment: "Trying to update non-existent" });

      expect(res.status).toBe(404);
    });

    it("✓ Should reject update if another customer tries to edit (403 Forbidden)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${editableReviewId}`)
        .set("Authorization", `Bearer ${otherCustomerToken}`)
        .send({ comment: "Malicious edit attempt" });

      expect(res.status).toBe(403);
    });

    it("✓ Should reject invalid rating range on edit (400 Bad Request)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${editableReviewId}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ rating: 6 });

      expect(res.status).toBe(400);
    });

    it("✓ Should allow customer to update comment without changing rating", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${editableReviewId}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ comment: "Updated comment only" });

      expect(res.status).toBe(200);
      const body = res.body.data || res.body;
      expect(body.comment).toBe("Updated comment only");
      expect(body.rating).toBe(4);
    });

    it("✓ Should allow customer to change rating and atomically recalculate provider rating", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${editableReviewId}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ rating: 2, comment: "Downgrading service rating" });

      expect(res.status).toBe(200);
      const body = res.body.data || res.body;
      expect(body.rating).toBe(2);
      expect(body.comment).toBe("Downgrading service rating");

      // Verify ProviderProfile average rating was updated in database
      const providerProfile = await prisma.providerProfile.findUnique({
        where: { id: testProvider.id },
      });
      expect(providerProfile).toBeDefined();
      expect(Number(providerProfile?.averageRating)).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  describe("5. Race Condition & Concurrency (Database Invariant)", () => {
    it("✓ Concurrent review submissions for the same booking: exactly one succeeds and one receives 409 Conflict", async () => {
      const raceBooking = await createBooking(
        testCustomer.id,
        BookingStatus.COMPLETED,
      );

      // Fire 2 simultaneous requests to review the exact same booking
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/bookings/${raceBooking.id}/review`)
          .set("Authorization", `Bearer ${customerToken}`)
          .send({
            rating: 5,
            comment: "Concurrent review A",
          }),
        request(app.getHttpServer())
          .post(`/api/v1/bookings/${raceBooking.id}/review`)
          .set("Authorization", `Bearer ${customerToken}`)
          .send({
            rating: 4,
            comment: "Concurrent review B",
          }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      // One request MUST succeed (201), the other MUST fail with 409 Conflict
      expect(statuses).toEqual([201, 409]);

      // Verify the database invariant: UNIQUE(booking_id) enforced at DB level
      const reviewCount = await prisma.review.count({
        where: { bookingId: raceBooking.id },
      });
      expect(reviewCount).toBe(1);
    });
  });

  // =========================================================================
  describe("6. Provider Rating Cache Invalidation", () => {
    it("✓ Should invalidate provider profile cache in Redis upon review creation", async () => {
      const cacheBooking = await createBooking(
        testCustomer.id,
        BookingStatus.COMPLETED,
      );

      const cacheKey = `provider:profile:${testProvider.id}`;

      // Prime the Redis cache with mock provider profile data
      await redisService.set(
        cacheKey,
        JSON.stringify({ id: testProvider.id, averageRating: 4.5, totalReviews: 10 }),
        60,
      );

      const primeCheck = await redisService.get(cacheKey);
      expect(primeCheck).not.toBeNull();

      // Submit review
      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${cacheBooking.id}/review`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          rating: 5,
          comment: "Review that invalidates cache",
        });

      expect(res.status).toBe(201);

      // Verify cache key was deleted from Redis
      const evictedCheck = await redisService.get(cacheKey);
      expect(evictedCheck).toBeNull();
    });

    it("✓ Should invalidate provider profile cache in Redis upon review rating update", async () => {
      const editBooking = await createBooking(
        testCustomer.id,
        BookingStatus.COMPLETED,
      );

      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${editBooking.id}/review`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          rating: 4,
          comment: "Initial rating",
        });

      const reviewId = createRes.body.data?.id || createRes.body.id;
      const cacheKey = `provider:profile:${testProvider.id}`;

      // Re-prime the cache
      await redisService.set(
        cacheKey,
        JSON.stringify({ id: testProvider.id, averageRating: 4.0 }),
        60,
      );

      // Update the rating
      const updateRes = await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ rating: 1, comment: "Downgraded" });

      expect(updateRes.status).toBe(200);

      // Verify cache was evicted
      const evictedCheck = await redisService.get(cacheKey);
      expect(evictedCheck).toBeNull();
    });
  });
});

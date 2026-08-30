import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/database/prisma/prisma.service";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { PrismaClientExceptionFilter } from "../src/common/filters/prisma-client-exception.filter";
import {
  Role,
  ServiceMode,
  UserStatus,
  VerificationStatus,
} from "../generated/prisma/client";

describe("Booking Concurrency & Overlap Prevention (e2e)", () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  let customer1Token: string;
  let customer2Token: string;
  let customer3Token: string;

  let providerServiceId: string;
  let providerProfileId: string;
  let categoryId: string;
  let serviceId: string;

  const testProviderEmail = "booking_provider_test@example.com";
  const testCustomer1Email = "booking_customer1_test@example.com";
  const testCustomer2Email = "booking_customer2_test@example.com";
  const testCustomer3Email = "booking_customer3_test@example.com";

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalFilters(
      new HttpExceptionFilter(),
      new PrismaClientExceptionFilter(),
    );
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
    prismaService = app.get(PrismaService);

    // 1. Cleanup old test data if any
    await cleanupTestData();

    // 2. Register Customers
    const c1Reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testCustomer1Email,
        password: "Password123!",
        firstName: "Customer",
        lastName: "One",
        phone: "+919800000001",
      });
    customer1Token = c1Reg.body.data.accessToken;

    const c2Reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testCustomer2Email,
        password: "Password123!",
        firstName: "Customer",
        lastName: "Two",
        phone: "+919800000002",
      });
    customer2Token = c2Reg.body.data.accessToken;

    const c3Reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testCustomer3Email,
        password: "Password123!",
        firstName: "Customer",
        lastName: "Three",
        phone: "+919800000003",
      });
    customer3Token = c3Reg.body.data.accessToken;

    // 3. Register & Setup Provider
    const provReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testProviderEmail,
        password: "Password123!",
        firstName: "Provider",
        lastName: "Boss",
        phone: "+919800000004",
      });
    const providerUserId = provReg.body.data.user.id;

    // Create Category & Base Service
    const category = await prismaService.category.create({
      data: {
        name: "Test Cleaning Category " + Date.now(),
        slug: "test-cleaning-" + Date.now(),
      },
    });
    categoryId = category.id;

    const baseService = await prismaService.service.create({
      data: {
        categoryId: category.id,
        name: "Deep Home Cleaning",
        slug: "deep-home-cleaning-" + Date.now(),
        serviceMode: ServiceMode.AT_CUSTOMER_LOCATION,
        defaultDuration: 60,
      },
    });
    serviceId = baseService.id;

    // Create Verified Provider Profile
    const profile = await prismaService.providerProfile.create({
      data: {
        userId: providerUserId,
        businessName: "Super Cleaners Ltd",
        experienceYears: 4,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });
    providerProfileId = profile.id;

    // Create 7-day availability (00:00 to 23:59) so any day/time slot is available in schedule
    for (let day = 0; day <= 6; day++) {
      await prismaService.availability.create({
        data: {
          providerId: profile.id,
          weekday: day,
          startTime: "00:00",
          endTime: "23:59",
          isAvailable: true,
        },
      });
    }

    // Create Provider Service Offering (60 mins + 15 min buffer)
    const offering = await prismaService.providerService.create({
      data: {
        providerId: profile.id,
        serviceId: baseService.id,
        price: 999.0,
        currency: "INR",
        durationMinutes: 60,
        bufferMinutes: 15,
        isActive: true,
      },
    });
    providerServiceId = offering.id;
  }, 30000);

  afterAll(async () => {
    await cleanupTestData();
    if (app) {
      await app.close();
    }
  });

  async function cleanupTestData() {
    const emails = [
      testProviderEmail,
      testCustomer1Email,
      testCustomer2Email,
      testCustomer3Email,
    ];

    if (!prismaService) return;

    await prismaService.auditLog.deleteMany({
      where: { actorUser: { email: { in: emails } } },
    });

    await prismaService.payment.deleteMany({
      where: { booking: { customer: { email: { in: emails } } } },
    });

    await prismaService.booking.deleteMany({
      where: {
        OR: [
          { customer: { email: { in: emails } } },
          { provider: { user: { email: testProviderEmail } } },
        ],
      },
    });

    await prismaService.availability.deleteMany({
      where: { provider: { user: { email: testProviderEmail } } },
    });

    await prismaService.providerService.deleteMany({
      where: { provider: { user: { email: testProviderEmail } } },
    });

    if (serviceId) {
      await prismaService.service
        .delete({ where: { id: serviceId } })
        .catch(() => {});
    }

    if (categoryId) {
      await prismaService.category
        .delete({ where: { id: categoryId } })
        .catch(() => {});
    }

    await prismaService.providerProfile.deleteMany({
      where: { user: { email: testProviderEmail } },
    });

    await prismaService.user.deleteMany({
      where: { email: { in: emails } },
    });
  }

  it("Step 6: Race Condition Test — Exact Simultaneous Booking Requests", async () => {
    // Generate a booking slot 3 days in future at 10:00:00 UTC
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    targetDate.setUTCHours(10, 0, 0, 0);
    const startsAtIso = targetDate.toISOString();

    const payload = {
      providerServiceId,
      startsAt: startsAtIso,
      notes: "Simultaneous race condition test",
    };

    // Fire 2 concurrent requests at the exact same millisecond
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send(payload),
      request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer2Token}`)
        .send(payload),
    ]);

    const statuses = [res1.status, res2.status].sort();

    // Verify: Exactly one request succeeded (201) and the duplicate was rejected by Postgres (409)
    expect(statuses).toEqual([201, 409]);

    const successRes = res1.status === 201 ? res1 : res2;
    const conflictRes = res1.status === 409 ? res1 : res2;

    expect(successRes.body.success).toBe(true);
    expect(successRes.body.data).toHaveProperty("id");
    expect(successRes.body.data.bookingStatus).toBe("PENDING_PAYMENT");

    expect(conflictRes.body.success).toBe(false);
    expect(conflictRes.body.message).toContain(
      "The selected time slot is no longer available",
    );

    // Verify DB integrity: exactly 1 booking exists in the database
    const dbBookings = await prismaService.booking.findMany({
      where: {
        providerId: providerProfileId,
        bookingDate: new Date(targetDate.setUTCHours(0, 0, 0, 0)),
      },
    });

    expect(dbBookings.length).toBe(1);
  });

  it("Step 6.1: Partially Overlapping Booking Slot Rejection", async () => {
    // Attempt booking 30 minutes into the existing 60-minute booking (10:30 UTC)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    targetDate.setUTCHours(10, 30, 0, 0);

    const overlapPayload = {
      providerServiceId,
      startsAt: targetDate.toISOString(),
      notes: "Partially overlapping booking test",
    };

    const res = await request(app.getHttpServer())
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customer3Token}`)
      .send(overlapPayload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "The selected time slot is no longer available",
    );
  });

  it("Step 6.2: Non-Overlapping Slot Success", async () => {
    // Attempt booking after the first booking + duration (12:00 UTC)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    targetDate.setUTCHours(12, 0, 0, 0);

    const nonOverlapPayload = {
      providerServiceId,
      startsAt: targetDate.toISOString(),
      notes: "Non-overlapping valid booking",
    };

    const res = await request(app.getHttpServer())
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customer3Token}`)
      .send(nonOverlapPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("id");
  });
});

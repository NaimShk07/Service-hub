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
  BookingStatus,
  ServiceMode,
  UserStatus,
  VerificationStatus,
} from "../generated/prisma/client";
import { canTransitionBooking } from "../src/modules/booking/domain/booking-state-machine";

describe("Day 7: Booking Concurrency, Validation & State Invariants (e2e)", () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  let customer1Token: string;
  let customer2Token: string;
  let customer3Token: string;

  let providerServiceId: string;
  let providerProfileId: string;
  let providerUserId: string;
  let categoryId: string;
  let serviceId: string;

  // Inactive / unverified / suspended provider fixtures
  let unverifiedProviderServiceId: string;
  let suspendedProviderServiceId: string;
  let inactiveProviderServiceId: string;

  const testProviderEmail = "day7_provider_active@example.com";
  const testUnverifiedProviderEmail = "day7_provider_unverified@example.com";
  const testSuspendedProviderEmail = "day7_provider_suspended@example.com";
  const testCustomer1Email = "day7_customer1@example.com";
  const testCustomer2Email = "day7_customer2@example.com";
  const testCustomer3Email = "day7_customer3@example.com";

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

    // 1. Clean up old test data
    await cleanupTestData();

    // 2. Register Customers
    const c1Reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testCustomer1Email,
        password: "Password123!",
        firstName: "Customer",
        lastName: "One",
        phone: "+919811111111",
      });
    customer1Token = c1Reg.body.data.accessToken;

    const c2Reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testCustomer2Email,
        password: "Password123!",
        firstName: "Customer",
        lastName: "Two",
        phone: "+919811111112",
      });
    customer2Token = c2Reg.body.data.accessToken;

    const c3Reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testCustomer3Email,
        password: "Password123!",
        firstName: "Customer",
        lastName: "Three",
        phone: "+919811111113",
      });
    customer3Token = c3Reg.body.data.accessToken;

    // 3. Register & Setup Standard Active Verified Provider
    const provReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testProviderEmail,
        password: "Password123!",
        firstName: "Active",
        lastName: "Provider",
        phone: "+919811111114",
      });
    providerUserId = provReg.body.data.user.id;

    const category = await prismaService.category.create({
      data: {
        name: "Day 7 Electrical Services " + Date.now(),
        slug: "day7-electrical-" + Date.now(),
      },
    });
    categoryId = category.id;

    const baseService = await prismaService.service.create({
      data: {
        categoryId: category.id,
        name: "Electrical Wiring & Inspection",
        slug: "wiring-inspection-" + Date.now(),
        serviceMode: ServiceMode.AT_CUSTOMER_LOCATION,
        defaultDuration: 60,
      },
    });
    serviceId = baseService.id;

    const profile = await prismaService.providerProfile.create({
      data: {
        userId: providerUserId,
        businessName: "Elite Electricians Ltd",
        experienceYears: 7,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });
    providerProfileId = profile.id;

    // Provider Shift: Mon-Sun from 08:00 to 20:00 UTC
    for (let day = 0; day <= 6; day++) {
      await prismaService.availability.create({
        data: {
          providerId: profile.id,
          weekday: day,
          startTime: "08:00",
          endTime: "20:00",
          isAvailable: true,
        },
      });
    }

    // Active Service: 60 min duration + 15 min buffer
    const activeOffering = await prismaService.providerService.create({
      data: {
        providerId: profile.id,
        serviceId: baseService.id,
        price: 750.0,
        currency: "INR",
        durationMinutes: 60,
        bufferMinutes: 15,
        isActive: true,
      },
    });
    providerServiceId = activeOffering.id;

    // Inactive Offering under verified provider
    const inactiveBaseService = await prismaService.service.create({
      data: {
        categoryId: category.id,
        name: "Secondary Inspection " + Date.now(),
        slug: "secondary-inspection-" + Date.now(),
        serviceMode: ServiceMode.AT_CUSTOMER_LOCATION,
        defaultDuration: 45,
      },
    });

    const inactiveOffering = await prismaService.providerService.create({
      data: {
        providerId: profile.id,
        serviceId: inactiveBaseService.id,
        price: 500.0,
        currency: "INR",
        durationMinutes: 45,
        bufferMinutes: 10,
        isActive: false,
      },
    });
    inactiveProviderServiceId = inactiveOffering.id;

    // 4. Setup Unverified Provider
    const unverifiedUser = await prismaService.user.create({
      data: {
        email: testUnverifiedProviderEmail,
        passwordHash: "hash",
        firstName: "Unverified",
        lastName: "Prov",
        phone: "+919811111115",
        role: "USER",
        status: UserStatus.ACTIVE,
      },
    });
    const unverifiedProfile = await prismaService.providerProfile.create({
      data: {
        userId: unverifiedUser.id,
        businessName: "Unverified Co",
        experienceYears: 1,
        verificationStatus: VerificationStatus.PENDING,
      },
    });
    const unverifiedOffering = await prismaService.providerService.create({
      data: {
        providerId: unverifiedProfile.id,
        serviceId: baseService.id,
        price: 400.0,
        durationMinutes: 60,
        isActive: true,
      },
    });
    unverifiedProviderServiceId = unverifiedOffering.id;

    // 5. Setup Suspended Provider
    const suspendedUser = await prismaService.user.create({
      data: {
        email: testSuspendedProviderEmail,
        passwordHash: "hash",
        firstName: "Suspended",
        lastName: "Prov",
        phone: "+919811111116",
        role: "USER",
        status: UserStatus.BLOCKED,
      },
    });
    const suspendedProfile = await prismaService.providerProfile.create({
      data: {
        userId: suspendedUser.id,
        businessName: "Suspended Co",
        experienceYears: 2,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });
    const suspendedOffering = await prismaService.providerService.create({
      data: {
        providerId: suspendedProfile.id,
        serviceId: baseService.id,
        price: 600.0,
        durationMinutes: 60,
        isActive: true,
      },
    });
    suspendedProviderServiceId = suspendedOffering.id;
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
      testUnverifiedProviderEmail,
      testSuspendedProviderEmail,
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
          { provider: { user: { email: { in: emails } } } },
        ],
      },
    });
    await prismaService.availability.deleteMany({
      where: { provider: { user: { email: { in: emails } } } },
    });
    await prismaService.providerService.deleteMany({
      where: { provider: { user: { email: { in: emails } } } },
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
      where: { user: { email: { in: emails } } },
    });
    await prismaService.user.deleteMany({
      where: { email: { in: emails } },
    });
  }

  // =========================================================================
  // GROUP 1: Booking Creation & Domain Validation Edge Cases
  // =========================================================================
  describe("Group 1: Booking Creation & Domain Validations", () => {
    it("✓ Unknown provider service -> 404 Not Found", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          providerServiceId: "00000000-0000-0000-0000-000000000000",
          startsAt: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(res.status).toBe(404);
    });

    it("✓ Inactive service -> 404 Not Found", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          providerServiceId: inactiveProviderServiceId,
          startsAt: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(res.status).toBe(404);
    });

    it("✓ Unverified provider -> 400 Bad Request", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          providerServiceId: unverifiedProviderServiceId,
          startsAt: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("not verified");
    });

    it("✓ Suspended provider account -> 403 Forbidden", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          providerServiceId: suspendedProviderServiceId,
          startsAt: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("suspended or inactive");
    });

    it("✓ Past slot -> 400 Bad Request", async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          providerServiceId,
          startsAt: pastDate,
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("past");
    });

    it("✓ Outside availability shift hours -> 400 Bad Request", async () => {
      // Shift is 08:00 to 20:00 UTC. Try 05:00 UTC
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 2);
      targetDate.setUTCHours(5, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          providerServiceId,
          startsAt: targetDate.toISOString(),
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("shift hours");
    });

    it("✓ Service duration + buffer exceeds shift end -> 400 Bad Request", async () => {
      // Shift ends at 20:00 UTC. 60m duration + 15m buffer requested at 19:30 ends at 20:45 UTC
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 2);
      targetDate.setUTCHours(19, 30, 0, 0);

      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          providerServiceId,
          startsAt: targetDate.toISOString(),
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("shift hours");
    });

    it("✓ Commercial Snapshot Integrity (Price & duration frozen at booking)", async () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 4);
      targetDate.setUTCHours(10, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          providerServiceId,
          startsAt: targetDate.toISOString(),
          notes: "Snapshot test",
        });

      expect(res.status).toBe(201);
      expect(Number(res.body.data.bookedPrice)).toBe(750);
      expect(res.body.data.bookedDuration).toBe(60);
      expect(res.body.data.serviceName).toBe("Electrical Wiring & Inspection");
      expect(res.body.data.providerBusinessName).toBe("Elite Electricians Ltd");
    });
  });

  // =========================================================================
  // GROUP 2: Concurrency & Interval Overlap Prevention (PostgreSQL GiST)
  // =========================================================================
  describe("Group 2: PostgreSQL Concurrency & Overlap Invariants", () => {
    it("✓ Simultaneous Race Condition (Two requests, exact same millisecond) -> 1 Success, 1 Conflict", async () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 5);
      targetDate.setUTCHours(10, 0, 0, 0);
      const startsAt = targetDate.toISOString();

      const payload = {
        providerServiceId,
        startsAt,
        notes: "Race condition test",
      };

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
      expect(statuses).toEqual([201, 409]);

      // Invariant: Exactly 1 active booking exists in DB
      const dbBookings = await prismaService.booking.findMany({
        where: {
          providerId: providerProfileId,
          bookingDate: new Date(targetDate.setUTCHours(0, 0, 0, 0)),
        },
      });
      expect(dbBookings.length).toBe(1);
    });

    it("✓ Partial overlap at beginning (10:30 when 10:00-11:00 exists) -> 409 Conflict", async () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 5);
      targetDate.setUTCHours(10, 30, 0, 0);

      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer3Token}`)
        .send({ providerServiceId, startsAt: targetDate.toISOString() });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("time slot is no longer available");
    });

    it("✓ Adjacent booking immediately following existing booking (11:00 -> 12:00) -> 201 Created", async () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 5);
      targetDate.setUTCHours(11, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer3Token}`)
        .send({ providerServiceId, startsAt: targetDate.toISOString() });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id");
    });
  });

  // =========================================================================
  // GROUP 3: State Machine & Domain Transitions
  // =========================================================================
  describe("Group 3: Booking State Machine Invariants", () => {
    it("✓ Valid state transitions according to domain rules", () => {
      expect(
        canTransitionBooking(
          BookingStatus.PENDING_PAYMENT,
          BookingStatus.CONFIRMED,
        ),
      ).toBe(true);
      expect(
        canTransitionBooking(
          BookingStatus.PENDING_PAYMENT,
          BookingStatus.EXPIRED,
        ),
      ).toBe(true);
      expect(
        canTransitionBooking(BookingStatus.CONFIRMED, BookingStatus.COMPLETED),
      ).toBe(true);
      expect(
        canTransitionBooking(BookingStatus.CONFIRMED, BookingStatus.CANCELLED),
      ).toBe(true);
    });

    it("✓ Invalid state transitions rejected by domain state machine", () => {
      expect(
        canTransitionBooking(BookingStatus.COMPLETED, BookingStatus.CANCELLED),
      ).toBe(false);
      expect(
        canTransitionBooking(BookingStatus.CANCELLED, BookingStatus.CONFIRMED),
      ).toBe(false);
      expect(
        canTransitionBooking(BookingStatus.EXPIRED, BookingStatus.CONFIRMED),
      ).toBe(false);
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import request from "supertest";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/database/prisma/prisma.service";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaClientExceptionFilter } from "../src/common/filters/prisma-client-exception.filter";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import {
  AuditAction,
  BookingStatus,
  PaymentGateway,
  PaymentStatus,
  Role,
  ServiceMode,
  UserStatus,
  VerificationStatus,
} from "../generated/prisma/client";

describe("Repeatable Marketplace Workflow Smoke Test (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const webhookSecret = "rzp_test_webhook_secret";

  // State shared across steps of the journey
  let providerToken: string;
  let providerUserId: string;
  let providerProfileId: string;

  let adminToken: string;
  let adminUserId: string;

  let customerToken: string;
  let customerUserId: string;

  let categoryId: string;
  let serviceId: string;
  let providerServiceId: string;

  let bookingId: string;
  let gatewayOrderId: string;

  const ts = Date.now();
  const genPhone = () => `+91${Math.floor(7000000000 + Math.random() * 2000000000)}`;

  function createSignedWebhook(body: object) {
    const rawString = JSON.stringify(body);
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawString)
      .digest("hex");
    return { rawString, signature };
  }

  beforeAll(async () => {
    // Override ThrottlerGuard so rapid multi-step integration flow is never rate-limited
    jest.spyOn(ThrottlerGuard.prototype, "canActivate").mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(
      new HttpExceptionFilter(),
      new PrismaClientExceptionFilter(),
    );
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Cleanup created data in reverse dependency order
    const userIds = [providerUserId, adminUserId, customerUserId].filter(Boolean);

    if (userIds.length > 0) {
      await prisma.review.deleteMany({
        where: { customerId: customerUserId },
      }).catch(() => null);

      await prisma.payment.deleteMany({
        where: { bookingId },
      }).catch(() => null);

      await prisma.booking.deleteMany({
        where: { customerId: customerUserId },
      }).catch(() => null);

      await prisma.availability.deleteMany({
        where: { providerId: providerProfileId },
      }).catch(() => null);

      await prisma.providerService.deleteMany({
        where: { providerId: providerProfileId },
      }).catch(() => null);

      await prisma.providerDocument.deleteMany({
        where: { providerId: providerProfileId },
      }).catch(() => null);

      await prisma.providerLocation.deleteMany({
        where: { providerId: providerProfileId },
      }).catch(() => null);

      await prisma.providerProfile.deleteMany({
        where: { id: providerProfileId },
      }).catch(() => null);

      if (serviceId) {
        await prisma.service.delete({ where: { id: serviceId } }).catch(() => null);
      }
      if (categoryId) {
        await prisma.category.delete({ where: { id: categoryId } }).catch(() => null);
      }

      await prisma.auditLog.deleteMany({
        where: { actorId: { in: userIds } },
      }).catch(() => null);

      await prisma.notification.deleteMany({
        where: { userId: { in: userIds } },
      }).catch(() => null);

      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      }).catch(() => null);
    }

    await prisma.$disconnect();
    await app.close();
  });

  // =========================================================================
  // STEP 1: Registration & Provider Onboarding
  // =========================================================================
  describe("Step 1: User Registration & Provider Onboarding", () => {
    it("1.1 Should register a user who wants to become a provider", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: `flow_provider_${ts}@servicehub.test`,
          password: "StrongPassword123!",
          firstName: "Ramesh",
          lastName: "Sharma",
          phone: genPhone(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();
      providerToken = res.body.data.accessToken;
      providerUserId = res.body.data.user.id;
    });

    it("1.2 Should register an Admin user and grant ADMIN role", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: `flow_admin_${ts}@servicehub.test`,
          password: "AdminPassword123!",
          firstName: "System",
          lastName: "Admin",
          phone: genPhone(),
        });

      expect(res.status).toBe(201);
      adminUserId = res.body.data.user.id;

      // Promote to ADMIN role directly in DB
      await prisma.user.update({
        where: { id: adminUserId },
        data: { role: Role.ADMIN },
      });

      // Login as Admin to get admin token
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: `flow_admin_${ts}@servicehub.test`,
          password: "AdminPassword123!",
        });

      expect(loginRes.status).toBe(200);
      adminToken = loginRes.body.data.accessToken;
    });

    it("1.3 Provider creates business profile (status: PENDING)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/me/provider")
        .set("Authorization", `Bearer ${providerToken}`)
        .send({
          businessName: "Ramesh Urban Electricals",
          description: "Certified electrician with 8 years of home wiring experience",
          experienceYears: 8,
          addressLine1: "Shop 12, Link Road, Andheri West",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400053",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.businessName).toBe("Ramesh Urban Electricals");
      expect(res.body.data.verificationStatus).toBe(VerificationStatus.PENDING);
      providerProfileId = res.body.data.id;
    });

    it("1.4 Admin verifies provider profile", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/providers/${providerProfileId}/verify`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.verificationStatus).toBe(VerificationStatus.VERIFIED);

      // Verify in DB
      const profileInDb = await prisma.providerProfile.findUnique({
        where: { id: providerProfileId },
      });
      expect(profileInDb?.verificationStatus).toBe(VerificationStatus.VERIFIED);
    });
  });

  // =========================================================================
  // STEP 2: Catalog, Offering & Availability Setup
  // =========================================================================
  describe("Step 2: Service Offering & Availability Schedule Setup", () => {
    it("2.1 Setup catalog category and base service in database", async () => {
      const cat = await prisma.category.create({
        data: {
          name: `Electrical Services ${ts}`,
          slug: `electrical-services-${ts}`,
        },
      });
      categoryId = cat.id;

      const svc = await prisma.service.create({
        data: {
          name: "Complete Home Electrical Inspection",
          slug: `electrical-inspection-${ts}`,
          categoryId: cat.id,
          serviceMode: ServiceMode.AT_CUSTOMER_LOCATION,
          defaultDuration: 60,
        },
      });
      serviceId = svc.id;
    });

    it("2.2 Provider creates service offering and sets availability schedule", async () => {
      // Provider service offering: ₹999.00 for 60 min inspection
      const offering = await prisma.providerService.create({
        data: {
          providerId: providerProfileId,
          serviceId: serviceId,
          price: 999.0,
          currency: "INR",
          durationMinutes: 60,
          bufferMinutes: 15,
          isActive: true,
        },
      });
      providerServiceId = offering.id;

      // Availability: Mon-Sun 08:00 to 20:00 UTC
      for (let day = 0; day <= 6; day++) {
        await prisma.availability.create({
          data: {
            providerId: providerProfileId,
            weekday: day,
            startTime: "08:00",
            endTime: "20:00",
            isAvailable: true,
          },
        });
      }

      const availabilities = await prisma.availability.findMany({
        where: { providerId: providerProfileId },
      });
      expect(availabilities.length).toBe(7);
    });
  });

  // =========================================================================
  // STEP 3: Customer Registration & Discovery
  // =========================================================================
  describe("Step 3: Customer Registration & Service Discovery", () => {
    it("3.1 Should register a new customer", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: `flow_customer_${ts}@servicehub.test`,
          password: "CustomerPassword123!",
          firstName: "Anjali",
          lastName: "Deshmukh",
          phone: genPhone(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();
      customerToken = res.body.data.accessToken;
      customerUserId = res.body.data.user.id;
    });

    it("3.2 Customer discovers provider offering via search/catalog", async () => {
      // Customer inspects provider service details
      const offeringInDb = await prisma.providerService.findUnique({
        where: { id: providerServiceId },
        include: { provider: true, service: true },
      });

      expect(offeringInDb).toBeDefined();
      expect(offeringInDb?.isActive).toBe(true);
      expect(offeringInDb?.provider.verificationStatus).toBe(VerificationStatus.VERIFIED);
      expect(Number(offeringInDb?.price)).toBe(999.0);
    });
  });

  // =========================================================================
  // STEP 4: Slot Booking & Payment Checkout Flow
  // =========================================================================
  describe("Step 4: Booking Reservation & Payment Confirmation", () => {
    it("4.1 Customer reserves a future slot (status: PENDING_PAYMENT)", async () => {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 2); // 2 days ahead
      bookingDate.setUTCHours(10, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          providerServiceId: providerServiceId,
          startsAt: bookingDate.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.bookingStatus).toBe(BookingStatus.PENDING_PAYMENT);
      expect(Number(res.body.data.bookedPrice)).toBe(999.0);

      bookingId = res.body.data.id;
    });

    it("4.2 Customer creates a Razorpay payment order for the booking", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/payments/orders")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          bookingId: bookingId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.gatewayOrderId).toBeDefined();
      expect(res.body.data.status).toBe(PaymentStatus.CREATED);

      gatewayOrderId = res.body.data.gatewayOrderId;
    });

    it("4.3 Razorpay payment webhook captures payment and confirms booking", async () => {
      const eventId = `evt_flow_${Date.now()}`;
      const paymentId = `pay_flow_${Date.now()}`;

      // ₹999.00 = 99900 paise
      const { rawString, signature } = createSignedWebhook({
        entity: "event",
        event: "payment.captured",
        event_id: eventId,
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: gatewayOrderId,
              amount: 99900,
              currency: "INR",
              status: "captured",
            },
          },
        },
      });

      const res = await request(app.getHttpServer())
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .set("x-razorpay-event-id", eventId)
        .send(rawString);

      expect(res.status).toBe(200);

      // Verify booking is now CONFIRMED in DB
      const bookingInDb = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(bookingInDb?.bookingStatus).toBe(BookingStatus.CONFIRMED);

      // Verify payment is SUCCESS in DB
      const paymentInDb = await prisma.payment.findFirst({
        where: { gatewayOrderId },
      });
      expect(paymentInDb?.status).toBe(PaymentStatus.SUCCESS);
      expect(paymentInDb?.gatewayPaymentId).toBe(paymentId);
    });
  });

  // =========================================================================
  // STEP 5: Job Execution & Provider Completion
  // =========================================================================
  describe("Step 5: Job Completion by Provider", () => {
    it("5.1 Provider marks the confirmed booking as COMPLETED", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${bookingId}/complete`)
        .set("Authorization", `Bearer ${providerToken}`);

      expect(res.status).toBe(201);
      expect(res.body.data.bookingStatus).toBe(BookingStatus.COMPLETED);
      expect(res.body.data.completedAt).toBeDefined();

      // Check DB persistence
      const bookingInDb = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(bookingInDb?.bookingStatus).toBe(BookingStatus.COMPLETED);
      expect(bookingInDb?.completedAt).not.toBeNull();
    });
  });

  // =========================================================================
  // STEP 6: Customer Review & Rating Recalculation
  // =========================================================================
  describe("Step 6: Customer Review & Provider Reputation Recalculation", () => {
    it("6.1 Customer leaves a 5-star review for the completed booking", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          bookingId: bookingId,
          rating: 5,
          comment: "Punctual, highly professional, solved my MCB tripping issue in minutes!",
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.bookingId).toBe(bookingId);
    });

    it("6.2 Provider profile average rating and review count are updated", async () => {
      const profile = await prisma.providerProfile.findUnique({
        where: { id: providerProfileId },
      });

      expect(profile).toBeDefined();
      expect(Number(profile?.averageRating)).toBe(5);
      expect(profile?.totalReviews).toBe(1);
    });
  });

  // =========================================================================
  // STEP 7: Comprehensive Invariant & Audit Trail Verification
  // =========================================================================
  describe("Step 7: Platform Invariant & Audit Trail Verification", () => {
    it("7.1 Audit trail records exist for critical lifecycle actions", async () => {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          OR: [
            { entityId: providerProfileId },
            { entityId: bookingId },
          ],
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);

      // Verify Provider Verification was audited
      const verifyAudit = auditLogs.find((l) => l.action === AuditAction.PROVIDER_VERIFIED);
      expect(verifyAudit).toBeDefined();
      expect(verifyAudit?.actorUserId).toBe(adminUserId);

      // Verify Booking Completed was audited
      const completionAudit = auditLogs.find((l) => l.action === AuditAction.BOOKING_COMPLETED);
      expect(completionAudit).toBeDefined();
      expect(completionAudit?.actorUserId).toBe(providerUserId);
    });

    it("7.2 Final data consistency across all database records", async () => {
      const finalBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          payments: true,
          review: true,
          provider: true,
          customer: true,
        },
      });

      expect(finalBooking?.bookingStatus).toBe(BookingStatus.COMPLETED);
      expect(finalBooking?.payments[0]?.status).toBe(PaymentStatus.SUCCESS);
      expect(finalBooking?.review?.rating).toBe(5);
      expect(finalBooking?.provider.id).toBe(providerProfileId);
      expect(finalBooking?.customer.id).toBe(customerUserId);
    });
  });
});

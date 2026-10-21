import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import request from "supertest";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/database/prisma/prisma.service";
import { BookingService } from "../src/modules/booking/services/booking.service";
import { PaymentService } from "../src/modules/payment/services/payment.service";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaClientExceptionFilter } from "../src/common/filters/prisma-client-exception.filter";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import {
  BookingStatus,
  PaymentGateway,
  PaymentStatus,
  Role,
  ServiceMode,
  UserStatus,
  VerificationStatus,
} from "../generated/prisma/client";

describe("Day 3: Booking & Payment Failure Testing (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookingService: BookingService;
  let paymentService: PaymentService;

  const webhookSecret = "rzp_test_webhook_secret";

  // Fixtures
  let customer1Token: string;
  let customer1Id: string;
  let customer2Token: string;
  let customer2Id: string;
  let adminToken: string;
  let adminId: string;

  let activeProviderProfileId: string;
  let activeProviderServiceId: string;

  let suspendedProviderProfileId: string;
  let suspendedProviderServiceId: string;

  let categoryId: string;
  let baseServiceId: string;

  const ts = Date.now();
  const genPhone = () =>
    `+91${Math.floor(7000000000 + Math.random() * 2000000000)}`;

  function createSignedWebhook(body: object) {
    const rawString = JSON.stringify(body);
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawString)
      .digest("hex");
    return { rawString, signature };
  }

  beforeAll(async () => {
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
    bookingService = app.get<BookingService>(BookingService);
    paymentService = app.get<PaymentService>(PaymentService);

    // 1. Setup Customers & Admin
    const c1Reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: `fail_c1_${ts}@servicehub.test`,
        password: "Password123!",
        firstName: "FailCust",
        lastName: "One",
        phone: genPhone(),
      });
    customer1Token = c1Reg.body.data.accessToken;
    customer1Id = c1Reg.body.data.user.id;

    const c2Reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: `fail_c2_${ts}@servicehub.test`,
        password: "Password123!",
        firstName: "FailCust",
        lastName: "Two",
        phone: genPhone(),
      });
    customer2Token = c2Reg.body.data.accessToken;
    customer2Id = c2Reg.body.data.user.id;

    const adminReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: `fail_admin_${ts}@servicehub.test`,
        password: "Password123!",
        firstName: "FailAdmin",
        lastName: "User",
        phone: genPhone(),
      });
    adminId = adminReg.body.data.user.id;
    await prisma.user.update({
      where: { id: adminId },
      data: { role: Role.ADMIN },
    });
    const adminLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: `fail_admin_${ts}@servicehub.test`,
        password: "Password123!",
      });
    adminToken = adminLogin.body.data.accessToken;

    // 2. Setup Category & Catalog Service
    const cat = await prisma.category.create({
      data: {
        name: `Plumbing Service ${ts}`,
        slug: `plumbing-svc-${ts}`,
      },
    });
    categoryId = cat.id;

    const svc = await prisma.service.create({
      data: {
        name: `Pipe Leakage & Repair ${ts}`,
        slug: `pipe-leak-${ts}`,
        categoryId: cat.id,
        serviceMode: ServiceMode.AT_CUSTOMER_LOCATION,
        defaultDuration: 60,
      },
    });
    baseServiceId = svc.id;

    // 3. Setup Active Verified Provider (with 15 min buffer)
    const provUser = await prisma.user.create({
      data: {
        email: `prov_active_${ts}@servicehub.test`,
        passwordHash: "dummyhash",
        firstName: "Active",
        lastName: "Plumber",
        phone: genPhone(),
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });
    const provProfile = await prisma.providerProfile.create({
      data: {
        userId: provUser.id,
        businessName: "Elite Plumbers",
        experienceYears: 6,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });
    activeProviderProfileId = provProfile.id;

    for (let day = 0; day <= 6; day++) {
      await prisma.availability.create({
        data: {
          providerId: provProfile.id,
          weekday: day,
          startTime: "08:00",
          endTime: "20:00",
          isAvailable: true,
        },
      });
    }

    const activeOffering = await prisma.providerService.create({
      data: {
        providerId: provProfile.id,
        serviceId: svc.id,
        price: 500.0,
        currency: "INR",
        durationMinutes: 60,
        bufferMinutes: 15,
        isActive: true,
      },
    });
    activeProviderServiceId = activeOffering.id;

    // 4. Setup Suspended Provider
    const suspUser = await prisma.user.create({
      data: {
        email: `prov_susp_${ts}@servicehub.test`,
        passwordHash: "dummyhash",
        firstName: "Suspended",
        lastName: "Plumber",
        phone: genPhone(),
        role: Role.USER,
        status: UserStatus.BLOCKED,
      },
    });
    const suspProfile = await prisma.providerProfile.create({
      data: {
        userId: suspUser.id,
        businessName: "Blocked Services Ltd",
        experienceYears: 2,
        verificationStatus: VerificationStatus.SUSPENDED,
      },
    });
    suspendedProviderProfileId = suspProfile.id;

    const suspOffering = await prisma.providerService.create({
      data: {
        providerId: suspProfile.id,
        serviceId: svc.id,
        price: 350.0,
        currency: "INR",
        durationMinutes: 60,
        isActive: true,
      },
    });
    suspendedProviderServiceId = suspOffering.id;
  });

  afterAll(async () => {
    // Teardown created test records
    await prisma.review
      .deleteMany({
        where: { customerId: { in: [customer1Id, customer2Id] } },
      })
      .catch(() => null);

    await prisma.payment
      .deleteMany({
        where: { booking: { customerId: { in: [customer1Id, customer2Id] } } },
      })
      .catch(() => null);

    await prisma.booking
      .deleteMany({
        where: { customerId: { in: [customer1Id, customer2Id] } },
      })
      .catch(() => null);

    await prisma.availability
      .deleteMany({
        where: {
          providerId: {
            in: [activeProviderProfileId, suspendedProviderProfileId],
          },
        },
      })
      .catch(() => null);

    await prisma.providerService
      .deleteMany({
        where: {
          providerId: {
            in: [activeProviderProfileId, suspendedProviderProfileId],
          },
        },
      })
      .catch(() => null);

    await prisma.providerProfile
      .deleteMany({
        where: {
          id: { in: [activeProviderProfileId, suspendedProviderProfileId] },
        },
      })
      .catch(() => null);

    if (baseServiceId) {
      await prisma.service
        .delete({ where: { id: baseServiceId } })
        .catch(() => null);
    }
    if (categoryId) {
      await prisma.category
        .delete({ where: { id: categoryId } })
        .catch(() => null);
    }

    await prisma.auditLog
      .deleteMany({
        where: { actorUserId: { in: [customer1Id, customer2Id, adminId] } },
      })
      .catch(() => null);

    await prisma.user
      .deleteMany({
        where: { id: { in: [customer1Id, customer2Id, adminId] } },
      })
      .catch(() => null);

    await prisma.$disconnect();
    await app.close();
  });

  // =========================================================================
  // GROUP A: BOOKING CORRECTNESS
  // =========================================================================
  describe("Group A: Booking Correctness Edge Cases", () => {
    let baseSlotTime: Date;

    beforeAll(() => {
      baseSlotTime = new Date();
      baseSlotTime.setDate(baseSlotTime.getDate() + 5);
      baseSlotTime.setUTCHours(10, 0, 0, 0);
    });

    it("✓ Scenario 1: Two customers compete for the same provider time slot (Concurrency)", async () => {
      const slot = new Date(baseSlotTime);

      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post("/api/v1/bookings")
          .set("Authorization", `Bearer ${customer1Token}`)
          .send({
            providerServiceId: activeProviderServiceId,
            startsAt: slot.toISOString(),
          }),
        request(app.getHttpServer())
          .post("/api/v1/bookings")
          .set("Authorization", `Bearer ${customer2Token}`)
          .send({
            providerServiceId: activeProviderServiceId,
            startsAt: slot.toISOString(),
          }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(conflictRes.body.message).toContain(
        "time slot is no longer available",
      );
    });

    it("✓ Scenario 2: Service duration and buffer prevent overlapping bookings", async () => {
      // 2A: Overlapping slot during active booking (10:30 overlaps with 10:00-11:00) -> 409 Conflict
      const overlappingSlot = new Date(baseSlotTime);
      overlappingSlot.setUTCHours(10, 30, 0, 0);

      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer2Token}`)
        .send({
          providerServiceId: activeProviderServiceId,
          startsAt: overlappingSlot.toISOString(),
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("time slot is no longer available");

      // 2B: Service duration + post-service buffer exceeds shift end (19:30 + 60m + 15m buffer = 20:45 > 20:00) -> 400 Bad Request
      const exceedSlot = new Date(baseSlotTime);
      exceedSlot.setUTCHours(19, 30, 0, 0);

      const exceedRes = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer2Token}`)
        .send({
          providerServiceId: activeProviderServiceId,
          startsAt: exceedSlot.toISOString(),
        });

      expect(exceedRes.status).toBe(400);
      expect(exceedRes.body.message).toContain("shift hours");
    });

    it("✓ Scenario 3: Expired payment reservation releases the slot correctly", async () => {
      // Setup slot at 14:00 UTC
      const slot = new Date(baseSlotTime);
      slot.setUTCHours(14, 0, 0, 0);

      // Customer 1 books slot -> 201 Created
      const bookingRes = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          providerServiceId: activeProviderServiceId,
          startsAt: slot.toISOString(),
        });
      expect(bookingRes.status).toBe(201);
      const bookingId = bookingRes.body.data.id;

      // Customer 2 tries to book while pending -> 409 Conflict
      const blockedRes = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer2Token}`)
        .send({
          providerServiceId: activeProviderServiceId,
          startsAt: slot.toISOString(),
        });
      expect(blockedRes.status).toBe(409);

      // Timeout / Expiry worker triggers expiration
      const expireResult = await bookingService.expireBooking(bookingId);
      expect(expireResult.expired).toBe(true);

      // Customer 2 retries booking the now-released slot -> 201 Created
      const retryRes = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer2Token}`)
        .send({
          providerServiceId: activeProviderServiceId,
          startsAt: slot.toISOString(),
        });
      expect(retryRes.status).toBe(201);
      expect(retryRes.body.data.bookingStatus).toBe(
        BookingStatus.PENDING_PAYMENT,
      );
    });

    it("✓ Scenario 4: Cancellation respects the two-hour policy", async () => {
      // 4A: Booking scheduled 24 hours in advance -> Cancellation succeeds
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      futureDate.setUTCHours(10, 0, 0, 0);

      const validBooking = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          providerServiceId: activeProviderServiceId,
          startsAt: futureDate.toISOString(),
        });
      expect(validBooking.status).toBe(201);

      const cancelSuccess = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${validBooking.body.data.id}/cancel`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ reason: "Change of plans" });
      expect(cancelSuccess.status).toBe(200);
      expect(cancelSuccess.body.data.bookingStatus).toBe(
        BookingStatus.CANCELLED,
      );

      // 4B: Booking scheduled in 30 minutes (< 2 hours) -> Cancellation blocked with 409
      const urgentDate = new Date();
      urgentDate.setMinutes(urgentDate.getMinutes() + 30); // 30 minutes from now

      // Seed directly in DB to bypass start date validation
      const urgentBooking = await prisma.booking.create({
        data: {
          customerId: customer1Id,
          providerId: activeProviderProfileId,
          providerServiceId: activeProviderServiceId,
          bookingDate: urgentDate,
          startTime: urgentDate,
          endTime: new Date(urgentDate.getTime() + 60 * 60 * 1000),
          bookingStatus: BookingStatus.CONFIRMED,
          bookedPrice: 500.0,
          bookedDuration: 60,
          bookedServiceMode: ServiceMode.AT_CUSTOMER_LOCATION,
          serviceName: "Pipe Leakage",
          providerBusinessName: "Elite Plumbers",
        },
      });

      const cancelDenied = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${urgentBooking.id}/cancel`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ reason: "Emergency cancellation" });

      expect(cancelDenied.status).toBe(409);
      expect(cancelDenied.body.message).toContain(
        "within 2 hours of the scheduled appointment time",
      );
    });

    it("✓ Scenario 5: Suspended providers cannot receive new bookings", async () => {
      const slot = new Date(baseSlotTime);
      slot.setUTCHours(16, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          providerServiceId: suspendedProviderServiceId,
          startsAt: slot.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("not verified");
    });
  });

  // =========================================================================
  // GROUP B: PAYMENT CORRECTNESS
  // =========================================================================
  describe("Group B: Payment Correctness Edge Cases", () => {
    let testDayCounter = 10;
    async function createTestBookingAndOrder(price = 500.0) {
      testDayCounter++;
      const slot = new Date();
      slot.setDate(slot.getDate() + testDayCounter);
      slot.setUTCHours(10, 0, 0, 0);

      const booking = await prisma.booking.create({
        data: {
          customerId: customer1Id,
          providerId: activeProviderProfileId,
          providerServiceId: activeProviderServiceId,
          bookingDate: slot,
          startTime: slot,
          endTime: new Date(slot.getTime() + 60 * 60 * 1000),
          bookingStatus: BookingStatus.PENDING_PAYMENT,
          bookedPrice: price,
          bookedDuration: 60,
          bookedServiceMode: ServiceMode.AT_CUSTOMER_LOCATION,
          serviceName: "Pipe Leakage",
          providerBusinessName: "Elite Plumbers",
        },
      });

      const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          gateway: PaymentGateway.RAZORPAY,
          gatewayOrderId: orderId,
          amount: price,
          currency: "INR",
          status: PaymentStatus.CREATED,
        },
      });

      return { booking, payment, orderId };
    }

    it("✓ Scenario 6: Duplicate successful webhook does not confirm or process payment twice (Idempotency)", async () => {
      const { booking, orderId } = await createTestBookingAndOrder(500.0);
      const eventId = `evt_dup_${Date.now()}`;
      const paymentId = `pay_dup_${Date.now()}`;

      const { rawString, signature } = createSignedWebhook({
        entity: "event",
        event: "payment.captured",
        event_id: eventId,
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount: 50000, // ₹500.00
              currency: "INR",
              status: "captured",
            },
          },
        },
      });

      // 1st Webhook delivery -> Processed
      const res1 = await request(app.getHttpServer())
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .set("x-razorpay-event-id", eventId)
        .send(rawString);
      expect(res1.status).toBe(200);

      const freshBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(freshBooking?.bookingStatus).toBe(BookingStatus.CONFIRMED);

      // 2nd Duplicate Webhook delivery -> Idempotent no-op
      const res2 = await request(app.getHttpServer())
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .set("x-razorpay-event-id", eventId)
        .send(rawString);
      expect(res2.status).toBe(200);
      expect(res2.body.data.status).toBe("already_processed");
    });

    it("✓ Scenario 7: Invalid signature cannot confirm a booking", async () => {
      const { booking, orderId } = await createTestBookingAndOrder(500.0);
      const { rawString } = createSignedWebhook({
        entity: "event",
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: `pay_fake_${Date.now()}`,
              order_id: orderId,
              amount: 50000,
              currency: "INR",
              status: "captured",
            },
          },
        },
      });

      const res = await request(app.getHttpServer())
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", "fraudulent_signature_hex_value")
        .send(rawString);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid webhook signature");

      // Verify booking is still PENDING_PAYMENT
      const bookingInDb = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(bookingInDb?.bookingStatus).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it("✓ Scenario 8: Incorrect amount or currency is rejected", async () => {
      const { booking, payment, orderId } =
        await createTestBookingAndOrder(500.0); // Expecting 50000 paise

      // Attacker tampers amount to 100 paise (₹1)
      const { rawString, signature } = createSignedWebhook({
        entity: "event",
        event: "payment.captured",
        event_id: `evt_tamper_${Date.now()}`,
        payload: {
          payment: {
            entity: {
              id: `pay_tamper_${Date.now()}`,
              order_id: orderId,
              amount: 100, // TAMPERED!
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
        .send(rawString);

      expect(res.status).toBe(200);

      // Verify tampered amount/currency did NOT confirm booking or mark payment SUCCESS!
      const bookingInDb = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(bookingInDb?.bookingStatus).toBe(BookingStatus.PENDING_PAYMENT);

      const paymentInDb = await prisma.payment.findUnique({
        where: { id: payment.id },
      });
      expect(paymentInDb?.status).not.toBe(PaymentStatus.SUCCESS);
    });

    it("✓ Scenario 9: Payment success arriving near reservation expiry is handled safely (Race Condition)", async () => {
      const { booking, orderId } = await createTestBookingAndOrder(500.0);
      const paymentId = `pay_race_${Date.now()}`;
      const eventId = `evt_race_${Date.now()}`;

      const { rawString, signature } = createSignedWebhook({
        entity: "event",
        event: "payment.captured",
        event_id: eventId,
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount: 50000,
              currency: "INR",
              status: "captured",
            },
          },
        },
      });

      // Concurrently run Webhook Payment Success AND Timeout Expiry Worker
      const [webhookRes, expireRes] = await Promise.all([
        request(app.getHttpServer())
          .post("/api/v1/payments/webhook")
          .set("Content-Type", "application/json")
          .set("x-razorpay-signature", signature)
          .set("x-razorpay-event-id", eventId)
          .send(rawString),
        bookingService.expireBooking(booking.id),
      ]);

      expect(webhookRes.status).toBe(200);

      // Verify deterministic invariant:
      // Either:
      // A) Webhook won the race -> booking is CONFIRMED, payment is SUCCESS, expiry was skipped.
      // B) Expiry won the race -> booking is EXPIRED, payment is SUCCESS for accounting & flagged for refund.
      // IN NO CASE is booking corrupted or left in an inconsistent state.
      const finalBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
        include: { payments: true },
      });

      expect([BookingStatus.CONFIRMED, BookingStatus.EXPIRED]).toContain(
        finalBooking?.bookingStatus,
      );
      expect(finalBooking?.payments[0]?.status).toBe(PaymentStatus.SUCCESS);

      if (finalBooking?.bookingStatus === BookingStatus.EXPIRED) {
        // Safe refund flag must be registered in audit logs
        const audit = await prisma.auditLog.findFirst({
          where: {
            entityId: booking.id,
            action: "PAYMENT_SUCCESS",
          },
        });
        expect(audit).toBeDefined();
        expect(JSON.stringify(audit?.newValue)).toContain("REQUIRES_REFUND");
      }
    });

    it("✓ Scenario 10: Repeated refund requests cannot produce duplicate refunds", async () => {
      const { booking, payment, orderId } =
        await createTestBookingAndOrder(500.0);
      const paymentId = `pay_refund_${Date.now()}`;

      // 1. Confirm payment first
      await prisma.booking.update({
        where: { id: booking.id },
        data: { bookingStatus: BookingStatus.CONFIRMED },
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          gatewayPaymentId: paymentId,
        },
      });

      // 2. Admin issues 1st refund request -> 201 Created / 200 OK
      const refundRes1 = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Customer requested cancellation" });

      expect(refundRes1.status).toBe(201);
      expect(refundRes1.body.data.status).toBe(PaymentStatus.REFUNDED);

      // Verify in DB
      const refundedPayment = await prisma.payment.findUnique({
        where: { id: payment.id },
      });
      expect(refundedPayment?.status).toBe(PaymentStatus.REFUNDED);

      // 3. Admin issues 2nd duplicate refund request -> Rejected (400 Bad Request)
      const refundRes2 = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Customer requested cancellation duplicate" });

      expect(refundRes2.status).toBe(400);
      expect(refundRes2.body.message).toContain("already been refunded");
    });
  });
});

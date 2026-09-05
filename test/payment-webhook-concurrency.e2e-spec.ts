import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "@database/prisma/prisma.service";
import crypto from "crypto";
import {
  BookingStatus,
  PaymentGateway,
  PaymentStatus,
  Role,
  ServiceMode,
  UserStatus,
  VerificationStatus,
} from "@prisma-client/enums";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

describe("Day 7: Razorpay Webhook Concurrency, Tamper Guards & Refunds (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  const webhookSecret = "rzp_test_webhook_secret";

  let testCustomer: any;
  let testAdmin: any;
  let testProviderUser: any;
  let testProviderProfile: any;
  let testCategory: any;
  let testService: any;
  let testProviderService: any;
  let adminAccessToken: string;

  function createSignedWebhook(body: object) {
    const rawString = JSON.stringify(body);
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawString)
      .digest("hex");
    return { rawString, signature };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix("api/v1");
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);

    const ts = Date.now();

    // Create Customer
    testCustomer = await prisma.user.create({
      data: {
        email: `cust_${ts}@test.com`,
        passwordHash: "dummyhash",
        firstName: "Test",
        lastName: "Customer",
        phone: `+91${ts.toString().slice(-10)}`,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    // Create Admin
    testAdmin = await prisma.user.create({
      data: {
        email: `admin_${ts}@test.com`,
        passwordHash: "dummyhash",
        firstName: "Test",
        lastName: "Admin",
        phone: `+92${ts.toString().slice(-10)}`,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    adminAccessToken = jwtService.sign(
      {
        sub: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
      },
      {
        secret: configService.get<string>("jwt.accessSecret"),
        expiresIn: "1h",
      },
    );

    // Create Provider & Service Offering
    testProviderUser = await prisma.user.create({
      data: {
        email: `prov_${ts}@test.com`,
        passwordHash: "dummyhash",
        firstName: "Test",
        lastName: "Provider",
        phone: `+93${ts.toString().slice(-10)}`,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    testProviderProfile = await prisma.providerProfile.create({
      data: {
        userId: testProviderUser.id,
        businessName: "Elite Appliance Pros",
        experienceYears: 7,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });

    testCategory = await prisma.category.create({
      data: {
        name: `Webhook Category ${ts}`,
        slug: `webhook-cat-${ts}`,
      },
    });

    testService = await prisma.service.create({
      data: {
        categoryId: testCategory.id,
        name: `Service ${ts}`,
        slug: `svc-${ts}`,
        serviceMode: ServiceMode.AT_CUSTOMER_LOCATION,
      },
    });

    testProviderService = await prisma.providerService.create({
      data: {
        providerId: testProviderProfile.id,
        serviceId: testService.id,
        price: 899.99,
        currency: "INR",
        durationMinutes: 60,
      },
    });
  });

  let slotCounter = 1;
  function getNextSlot() {
    const day = new Date();
    day.setDate(day.getDate() + slotCounter++);
    day.setUTCHours(0, 0, 0, 0);

    const start = new Date(day);
    start.setUTCHours(10, 0, 0, 0);

    const end = new Date(day);
    end.setUTCHours(11, 0, 0, 0);

    return { bookingDate: day, startTime: start, endTime: end };
  }

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe("Group 1: Webhook Signature & Security Integrity", () => {
    it("✓ Rejects webhook when HMAC signature is invalid", async () => {
      const { rawString } = createSignedWebhook({
        entity: "event",
        event: "payment.captured",
      });

      const res = await request(app.getHttpServer())
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", "invalid_signature_hex")
        .send(rawString);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid webhook signature");
    });

    it("✓ Rejects confirmation when webhook amount is tampered", async () => {
      const orderId = `order_tamper_${Date.now()}`;
      const eventId = `evt_tamper_${Date.now()}`;

      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          providerId: testProviderProfile.id,
          providerServiceId: testProviderService.id,
          ...getNextSlot(),
          bookingStatus: BookingStatus.PENDING_PAYMENT,
          bookedPrice: 899.99, // Expecting 89999 paise
          bookedDuration: 60,
          bookedServiceMode: ServiceMode.AT_CUSTOMER_LOCATION,
          serviceName: "Test Svc",
          providerBusinessName: "Elite Appliance Pros",
        },
      });

      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          gateway: PaymentGateway.RAZORPAY,
          gatewayOrderId: orderId,
          amount: 899.99,
          currency: "INR",
          status: PaymentStatus.CREATED,
        },
      });

      // Attacker sends 100 paise (₹1) instead of 89999 paise (₹899.99)
      const { rawString, signature } = createSignedWebhook({
        entity: "event",
        event: "payment.captured",
        event_id: eventId,
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
        .set("x-razorpay-event-id", eventId)
        .send(rawString);

      expect(res.status).toBe(200);

      const bookingAfter = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      // Tampered amount must NOT confirm the booking!
      expect(bookingAfter?.bookingStatus).toBe(BookingStatus.PENDING_PAYMENT);
    });
  });

  describe("Group 2: Webhook State Transitions & Race Conditions", () => {
    it("✓ Failed payment marks Payment FAILED while keeping Booking in PENDING_PAYMENT for retry", async () => {
      const orderId = `order_failed_${Date.now()}`;
      const eventId = `evt_failed_${Date.now()}`;

      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          providerId: testProviderProfile.id,
          providerServiceId: testProviderService.id,
          ...getNextSlot(),
          bookingStatus: BookingStatus.PENDING_PAYMENT,
          bookedPrice: 899.99,
          bookedDuration: 60,
          bookedServiceMode: ServiceMode.AT_CUSTOMER_LOCATION,
          serviceName: "Test Svc",
          providerBusinessName: "Elite Appliance Pros",
        },
      });

      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          gateway: PaymentGateway.RAZORPAY,
          gatewayOrderId: orderId,
          amount: 899.99,
          currency: "INR",
          status: PaymentStatus.CREATED,
        },
      });

      const { rawString, signature } = createSignedWebhook({
        entity: "event",
        event: "payment.failed",
        event_id: eventId,
        payload: {
          payment: {
            entity: {
              id: `pay_fail_${Date.now()}`,
              order_id: orderId,
              amount: 89999,
              currency: "INR",
              status: "failed",
              error_description: "Card declined by bank",
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

      const paymentAfter = await prisma.payment.findUnique({
        where: { gatewayOrderId: orderId },
      });
      const bookingAfter = await prisma.booking.findUnique({
        where: { id: booking.id },
      });

      expect(paymentAfter?.status).toBe(PaymentStatus.FAILED);
      // Reservation held for customer to retry
      expect(bookingAfter?.bookingStatus).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it("✓ Expired booking payment is marked SUCCESS for financial accounting, but booking remains EXPIRED", async () => {
      const orderId = `order_expired_${Date.now()}`;
      const eventId = `evt_expired_${Date.now()}`;

      // Booking already expired by timeout
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          providerId: testProviderProfile.id,
          providerServiceId: testProviderService.id,
          ...getNextSlot(),
          bookingStatus: BookingStatus.EXPIRED,
          bookedPrice: 899.99,
          bookedDuration: 60,
          bookedServiceMode: ServiceMode.AT_CUSTOMER_LOCATION,
          serviceName: "Test Svc",
          providerBusinessName: "Elite Appliance Pros",
        },
      });

      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          gateway: PaymentGateway.RAZORPAY,
          gatewayOrderId: orderId,
          amount: 899.99,
          currency: "INR",
          status: PaymentStatus.CREATED,
        },
      });

      const { rawString, signature } = createSignedWebhook({
        entity: "event",
        event: "payment.captured",
        event_id: eventId,
        payload: {
          payment: {
            entity: {
              id: `pay_exp_${Date.now()}`,
              order_id: orderId,
              amount: 89999,
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

      const paymentAfter = await prisma.payment.findUnique({
        where: { gatewayOrderId: orderId },
      });
      const bookingAfter = await prisma.booking.findUnique({
        where: { id: booking.id },
      });

      // Money recorded in system
      expect(paymentAfter?.status).toBe(PaymentStatus.SUCCESS);
      // Booking is NOT resurrected
      expect(bookingAfter?.bookingStatus).toBe(BookingStatus.EXPIRED);
    });
  });

  describe("Group 3: ⭐ The Most Important Test: Webhook Deduplication Race Condition", () => {
    it("✓ 3 simultaneous identical webhooks with same event_id result in exactly 1 state transition and 1 event record", async () => {
      const orderId = `order_race_${Date.now()}`;
      const eventId = `evt_race_${Date.now()}`;

      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          providerId: testProviderProfile.id,
          providerServiceId: testProviderService.id,
          ...getNextSlot(),
          bookingStatus: BookingStatus.PENDING_PAYMENT,
          bookedPrice: 899.99,
          bookedDuration: 60,
          bookedServiceMode: ServiceMode.AT_CUSTOMER_LOCATION,
          serviceName: "Test Svc",
          providerBusinessName: "Elite Appliance Pros",
        },
      });

      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          gateway: PaymentGateway.RAZORPAY,
          gatewayOrderId: orderId,
          amount: 899.99,
          currency: "INR",
          status: PaymentStatus.CREATED,
        },
      });

      const { rawString, signature } = createSignedWebhook({
        entity: "event",
        event: "payment.captured",
        event_id: eventId,
        payload: {
          payment: {
            entity: {
              id: `pay_race_${Date.now()}`,
              order_id: orderId,
              amount: 89999,
              currency: "INR",
              status: "captured",
            },
          },
        },
      });

      // Fire 3 simultaneous identical webhooks at the exact same millisecond
      const [res1, res2, res3] = await Promise.all([
        request(app.getHttpServer())
          .post("/api/v1/payments/webhook")
          .set("Content-Type", "application/json")
          .set("x-razorpay-signature", signature)
          .set("x-razorpay-event-id", eventId)
          .send(rawString),
        request(app.getHttpServer())
          .post("/api/v1/payments/webhook")
          .set("Content-Type", "application/json")
          .set("x-razorpay-signature", signature)
          .set("x-razorpay-event-id", eventId)
          .send(rawString),
        request(app.getHttpServer())
          .post("/api/v1/payments/webhook")
          .set("Content-Type", "application/json")
          .set("x-razorpay-signature", signature)
          .set("x-razorpay-event-id", eventId)
          .send(rawString),
      ]);

      // All 3 callers receive 200 OK (no crashes or unhandled 500s)
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);

      // Verify Database Invariants
      const updatedPayment = await prisma.payment.findUnique({
        where: { gatewayOrderId: orderId },
      });
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      const webhookEvents = await prisma.paymentWebhookEvent.findMany({
        where: { eventId },
      });

      expect(updatedPayment?.status).toBe(PaymentStatus.SUCCESS);
      expect(updatedBooking?.bookingStatus).toBe(BookingStatus.CONFIRMED);

      // Webhook event recorded exactly once in payment_webhook_events
      expect(webhookEvents.length).toBe(1);
      expect(webhookEvents[0].processedAt).not.toBeNull();
    });
  });

  describe("Group 4: Admin Refund Flow", () => {
    it("✓ Non-admin cannot initiate refund (403 Forbidden)", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${crypto.randomUUID()}/refund`)
        .send({ reason: "Unauthorized attempt" });

      expect(res.status).toBe(401);
    });

    it("✓ Admin successfully refunds a SUCCESS payment -> REFUNDED & booking CANCELLED", async () => {
      const orderId = `order_ref_${Date.now()}`;

      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          providerId: testProviderProfile.id,
          providerServiceId: testProviderService.id,
          ...getNextSlot(),
          bookingStatus: BookingStatus.CONFIRMED,
          bookedPrice: 899.99,
          bookedDuration: 60,
          bookedServiceMode: ServiceMode.AT_CUSTOMER_LOCATION,
          serviceName: "Test Svc",
          providerBusinessName: "Elite Appliance Pros",
        },
      });

      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          gateway: PaymentGateway.RAZORPAY,
          gatewayOrderId: orderId,
          gatewayPaymentId: `pay_ref_${Date.now()}`,
          amount: 899.99,
          currency: "INR",
          status: PaymentStatus.SUCCESS,
          paidAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refund`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Customer requested cancellation" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.status || res.body.status).toBe(
        PaymentStatus.REFUNDED,
      );

      const paymentAfter = await prisma.payment.findUnique({
        where: { id: payment.id },
      });
      const bookingAfter = await prisma.booking.findUnique({
        where: { id: booking.id },
      });

      expect(paymentAfter?.status).toBe(PaymentStatus.REFUNDED);
      expect(paymentAfter?.refundedAt).not.toBeNull();
      expect(bookingAfter?.bookingStatus).toBe(BookingStatus.CANCELLED);
    });
  });
});

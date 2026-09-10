import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "@database/prisma/prisma.service";
import {
  BookingStatus,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PaymentGateway,
  PaymentStatus,
  Role,
  ServiceMode,
  UserStatus,
  VerificationStatus,
} from "@prisma-client/enums";
import { BookingService } from "@modules/booking/services/booking.service";
import { NotificationQueueService } from "@jobs/queues/notification.queue";
import { EmailService } from "@shared/mailer/email.service";
import { NotificationProcessor } from "@jobs/processors/notification.processor";
import { Job } from "bullmq";

describe("Day 7: BullMQ, Notifications, Reservation Expiration & Concurrency (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookingService: BookingService;
  let notificationQueueService: NotificationQueueService;
  let notificationProcessor: NotificationProcessor;
  let emailService: EmailService;

  let testCustomer: any;
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
    await app.init();

    prisma = app.get(PrismaService);
    bookingService = app.get(BookingService);
    notificationQueueService = app.get(NotificationQueueService);
    notificationProcessor = app.get(NotificationProcessor);
    emailService = app.get(EmailService);

    // Seed test fixtures
    testCustomer = await prisma.user.create({
      data: {
        email: `cust_${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Test",
        lastName: "Customer",
        phone: `+91${Date.now().toString().slice(-10)}`,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    const providerUser = await prisma.user.create({
      data: {
        email: `prov_${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Test",
        lastName: "Provider",
        phone: `+91${(Date.now() + 1).toString().slice(-10)}`,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    testProvider = await prisma.providerProfile.create({
      data: {
        userId: providerUser.id,
        businessName: "Clean Pro Services",
        experienceYears: 5,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });

    testCategory = await prisma.category.create({
      data: { name: `Cat_${Date.now()}`, slug: `cat-${Date.now()}` },
    });

    testService = await prisma.service.create({
      data: {
        name: "Deep Cleaning",
        slug: `deep-clean-${Date.now()}`,
        categoryId: testCategory.id,
        serviceMode: ServiceMode.AT_CUSTOMER_LOCATION,
      },
    });

    testProviderService = await prisma.providerService.create({
      data: {
        providerId: testProvider.id,
        serviceId: testService.id,
        price: 899.99,
        durationMinutes: 60,
      },
    });
  });

  afterAll(async () => {
    if (testCustomer) {
      await prisma.notification.deleteMany({
        where: { userId: testCustomer.id },
      });
      await prisma.payment.deleteMany({
        where: { booking: { customerId: testCustomer.id } },
      });
      await prisma.auditLog.deleteMany({
        where: { actorUserId: testCustomer.id },
      });
      await prisma.booking.deleteMany({
        where: { customerId: testCustomer.id },
      });
      await prisma.user.delete({ where: { id: testCustomer.id } });
    }
    await prisma.$disconnect();
    await app.close();
  }, 15000);

  let bookingDayCounter = 10;

  // Helper to create a test booking in PENDING_PAYMENT
  async function createTestBooking(
    bookingStatus = BookingStatus.PENDING_PAYMENT,
    appointmentStart?: Date,
    appointmentEnd?: Date,
  ) {
    bookingDayCounter += 2;
    let start: Date;
    let end: Date;
    let day: Date;

    if (appointmentStart && appointmentEnd) {
      start = appointmentStart;
      end = appointmentEnd;
      day = new Date(start);
      day.setUTCHours(0, 0, 0, 0);
    } else {
      day = new Date(Date.now() + bookingDayCounter * 24 * 60 * 60 * 1000);
      day.setUTCHours(0, 0, 0, 0);
      start = new Date(day);
      start.setUTCHours(10, 0, 0, 0);
      end = new Date(day);
      end.setUTCHours(11, 0, 0, 0);
    }

    const booking = await prisma.booking.create({
      data: {
        customerId: testCustomer.id,
        providerId: testProvider.id,
        providerServiceId: testProviderService.id,
        bookingDate: day,
        startTime: start,
        endTime: end,
        bookingStatus,
        bookedPrice: 899.99,
        bookedDuration: 60,
        bookedServiceMode: ServiceMode.AT_CUSTOMER_LOCATION,
        serviceName: "Deep Cleaning",
        providerBusinessName: "Clean Pro Services",
      },
    });

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        gateway: PaymentGateway.RAZORPAY,
        gatewayOrderId: `order_${Date.now()}_${Math.random()}`,
        amount: 899.99,
        currency: "INR",
        status: PaymentStatus.CREATED,
      },
    });

    return { booking, payment };
  }

  // =========================================================================
  describe("Group 1: Expiry Tests", () => {
    it("✓ Pending booking expires and slot is released", async () => {
      const { booking } = await createTestBooking(
        BookingStatus.PENDING_PAYMENT,
      );

      const result = await bookingService.expireBooking(booking.id);
      expect(result.expired).toBe(true);

      const fresh = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(fresh?.bookingStatus).toBe(BookingStatus.EXPIRED);

      const payments = await prisma.payment.findMany({
        where: { bookingId: booking.id },
      });
      expect(payments[0].status).toBe(PaymentStatus.FAILED);
    });

    it("✓ Confirmed booking is NOT expired (Idempotent safe guard)", async () => {
      const { booking } = await createTestBooking(BookingStatus.CONFIRMED);

      const result = await bookingService.expireBooking(booking.id);
      expect(result.skipped).toBe(true);
      expect(result.currentStatus).toBe(BookingStatus.CONFIRMED);

      const fresh = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(fresh?.bookingStatus).toBe(BookingStatus.CONFIRMED);
    });

    it("✓ Cancelled booking is NOT expired", async () => {
      const { booking } = await createTestBooking(BookingStatus.CANCELLED);

      const result = await bookingService.expireBooking(booking.id);
      expect(result.skipped).toBe(true);
      expect(result.currentStatus).toBe(BookingStatus.CANCELLED);
    });

    it("✓ Expiry job can run twice safely without duplicate state transitions", async () => {
      const { booking } = await createTestBooking(
        BookingStatus.PENDING_PAYMENT,
      );

      const run1 = await bookingService.expireBooking(booking.id);
      const run2 = await bookingService.expireBooking(booking.id);

      expect(run1.expired).toBe(true);
      expect(run2.skipped).toBe(true);
      expect(run2.currentStatus).toBe(BookingStatus.EXPIRED);
    });
  });

  // =========================================================================
  describe("Group 2: Concurrency Test", () => {
    it("✓ Two concurrent workers expiring the same booking safely transition exactly once", async () => {
      const { booking } = await createTestBooking(
        BookingStatus.PENDING_PAYMENT,
      );

      // Simulate Worker A and Worker B running at the exact same millisecond
      const [workerA, workerB] = await Promise.all([
        bookingService.expireBooking(booking.id),
        bookingService.expireBooking(booking.id),
      ]);

      const outcomes = [workerA, workerB];
      const expiredCount = outcomes.filter((o) => o.expired === true).length;
      const skippedCount = outcomes.filter((o) => o.skipped === true).length;

      expect(expiredCount).toBe(1);
      expect(skippedCount).toBe(1);

      const fresh = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(fresh?.bookingStatus).toBe(BookingStatus.EXPIRED);
    });
  });

  // =========================================================================
  describe("Group 3: Notification Scheduling & Late Booking Edge Cases", () => {
    it("✓ Booking 3 days in advance schedules confirmation, 24h, 2h, and review request", async () => {
      const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const { booking } = await createTestBooking(
        BookingStatus.CONFIRMED,
        start,
        end,
      );

      await notificationQueueService.scheduleBookingLifecycleNotifications(
        booking.id,
      );

      const notifications = await prisma.notification.findMany({
        where: { bookingId: booking.id },
      });

      const types = notifications.map((n) => n.type);
      expect(types).toContain(NotificationType.BOOKING_CONFIRMED);
      expect(types).toContain(NotificationType.REMINDER);
      expect(types).toContain(NotificationType.REVIEW_REQUEST);
      expect(notifications.length).toBe(4); // Confirm, 24h, 2h, Review
    });

    it("✓ Booking 1 hour in advance skips 24h and 2h reminders (No negative delays)", async () => {
      const start = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour away
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const { booking } = await createTestBooking(
        BookingStatus.CONFIRMED,
        start,
        end,
      );

      await notificationQueueService.scheduleBookingLifecycleNotifications(
        booking.id,
      );

      const notifications = await prisma.notification.findMany({
        where: { bookingId: booking.id },
      });

      const types = notifications.map((n) => n.type);
      expect(types).toContain(NotificationType.BOOKING_CONFIRMED);
      expect(types).toContain(NotificationType.REVIEW_REQUEST);
      expect(types).not.toContain(NotificationType.REMINDER); // Both 24h and 2h skipped!
    });
  });

  // =========================================================================
  describe("Group 4: Email Delivery & Failure Scenarios", () => {
    it("✓ Email success transitions notification status to SENT", async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testCustomer.id,
          type: NotificationType.BOOKING_CONFIRMED,
          channel: NotificationChannel.EMAIL,
          title: "Test Confirmed",
          body: "Your booking is confirmed",
          scheduledFor: new Date(),
          status: NotificationStatus.PENDING,
        },
      });

      const mockJob = {
        id: `test_job_${Date.now()}`,
        name: "booking.confirmation",
        data: {
          notificationId: notification.id,
          userId: testCustomer.id,
          type: NotificationType.BOOKING_CONFIRMED,
          channel: NotificationChannel.EMAIL,
          title: "Test Confirmed",
          body: "Your booking is confirmed",
        },
        attemptsMade: 0,
        timestamp: Date.now(),
      } as unknown as Job;

      await notificationProcessor.process(mockJob);

      const updated = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(updated?.status).toBe(NotificationStatus.SENT);
      expect(updated?.sentAt).toBeDefined();
    });

    it("✓ Email failure re-throws to trigger BullMQ retry and increments attemptCount", async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testCustomer.id,
          type: NotificationType.REMINDER,
          channel: NotificationChannel.EMAIL,
          title: "Test Failure",
          body: "Reminder",
          scheduledFor: new Date(),
          status: NotificationStatus.PENDING,
        },
      });

      // Mock email failure
      jest
        .spyOn(emailService, "sendEmail")
        .mockRejectedValueOnce(new Error("SMTP Connection Timeout"));

      const mockJob = {
        id: `test_fail_${Date.now()}`,
        name: "reminder.24h",
        data: {
          notificationId: notification.id,
          userId: testCustomer.id,
          type: NotificationType.REMINDER,
          channel: NotificationChannel.EMAIL,
          title: "Test Failure",
          body: "Reminder",
        },
        attemptsMade: 1,
        timestamp: Date.now(),
      } as unknown as Job;

      await expect(notificationProcessor.process(mockJob)).rejects.toThrow(
        "SMTP Connection Timeout",
      );

      const intermediate = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(intermediate?.status).toBe(NotificationStatus.PENDING);
      expect(intermediate?.attemptCount).toBe(2);
      expect(intermediate?.failureReason).toContain("SMTP Connection Timeout");
    });

    it("✓ Permanent failure hook marks notification as FAILED on retry exhaustion", async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testCustomer.id,
          type: NotificationType.REMINDER,
          channel: NotificationChannel.EMAIL,
          title: "Exhausted",
          body: "Reminder",
          scheduledFor: new Date(),
          status: NotificationStatus.PENDING,
        },
      });

      const mockJob = {
        id: `test_exhaust_${Date.now()}`,
        name: "reminder.24h",
        opts: { attempts: 3 },
        attemptsMade: 3,
        data: {
          notificationId: notification.id,
        },
      } as unknown as Job;

      await notificationProcessor.onFailed(
        mockJob,
        new Error("Permanent DNS Error"),
      );

      const finalRecord = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(finalRecord?.status).toBe(NotificationStatus.FAILED);
      expect(finalRecord?.failedAt).toBeDefined();
      expect(finalRecord?.failureReason).toBe("Permanent DNS Error");
    });
  });

  // =========================================================================
  describe("Group 5: Notifications API", () => {
    let customerToken: string;

    beforeAll(async () => {
      const jwtService = app.get(JwtService);
      customerToken = await jwtService.signAsync({
        sub: testCustomer.id,
        email: testCustomer.email,
        role: testCustomer.role,
      });
    });

    it("✓ GET /api/v1/notifications returns user's notification history", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const list = Array.isArray(res.body) ? res.body : res.body.data;
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]).toHaveProperty("type");
      expect(list[0]).toHaveProperty("status");
      expect(list[0]).toHaveProperty("title");
    });

    it("✓ PATCH /api/v1/notifications/:id/read marks notification as read", async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testCustomer.id,
          type: NotificationType.BOOKING_CONFIRMED,
          channel: NotificationChannel.EMAIL,
          title: "Read Test",
          body: "Read body",
          scheduledFor: new Date(),
          status: NotificationStatus.SENT,
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notification.id}/read`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const body = res.body.data || res.body;
      expect(body.success).toBe(true);
    });
  });
});

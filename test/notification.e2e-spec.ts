import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "@database/prisma/prisma.service";
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Role,
  UserStatus,
} from "@prisma-client/enums";

describe("Notification Center (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let testCustomer: any;
  let customerToken: string;

  let otherCustomer: any;
  let otherCustomerToken: string;

  let customerNotif1: any;
  let customerNotif2: any;
  let customerNotifAlreadyRead: any;
  let otherCustomerNotif: any;
  const originalReadAt = new Date("2026-01-01T10:00:00.000Z");

  jest.setTimeout(30000);

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
    jwtService = app.get(JwtService);

    // 1. Seed test customer
    testCustomer = await prisma.user.create({
      data: {
        email: `notif_cust_${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Notification",
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

    // 2. Seed other customer for tenant isolation checks
    otherCustomer = await prisma.user.create({
      data: {
        email: `notif_other_${Date.now()}@example.com`,
        passwordHash: "hash123",
        firstName: "Other",
        lastName: "Customer",
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

    // 3. Seed notifications
    customerNotif1 = await prisma.notification.create({
      data: {
        userId: testCustomer.id,
        type: NotificationType.BOOKING_CONFIRMED,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
        title: "Booking Confirmed",
        body: "Your booking is confirmed.",
        scheduledFor: new Date(),
        sentAt: new Date(),
        readAt: null,
      },
    });

    customerNotif2 = await prisma.notification.create({
      data: {
        userId: testCustomer.id,
        type: NotificationType.REVIEW_REQUEST,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
        title: "Leave a Review",
        body: "How was your service?",
        scheduledFor: new Date(),
        sentAt: new Date(),
        readAt: null,
      },
    });

    customerNotifAlreadyRead = await prisma.notification.create({
      data: {
        userId: testCustomer.id,
        type: NotificationType.REMINDER,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
        title: "Reminder",
        body: "Appointment tomorrow.",
        scheduledFor: new Date(),
        sentAt: new Date(),
        readAt: originalReadAt,
      },
    });

    otherCustomerNotif = await prisma.notification.create({
      data: {
        userId: otherCustomer.id,
        type: NotificationType.BOOKING_CONFIRMED,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
        title: "Other User Booking",
        body: "Private notification.",
        scheduledFor: new Date(),
        sentAt: new Date(),
        readAt: null,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testCustomer?.id || otherCustomer?.id) {
      await prisma.notification.deleteMany({
        where: {
          userId: { in: [testCustomer.id, otherCustomer.id] },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: { in: [testCustomer.id, otherCustomer.id] },
        },
      });
    }
    await app.close();
  });

  describe("GET /api/v1/notifications", () => {
    it("✓ Should reject unauthorized requests (401 Unauthorized)", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/notifications");
      expect(res.status).toBe(401);
    });

    it("✓ Should return all notifications for the authenticated user only", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data || res.body;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBe(3);

      const ids = items.map((n: any) => n.id);
      expect(ids).toContain(customerNotif1.id);
      expect(ids).toContain(customerNotif2.id);
      expect(ids).toContain(customerNotifAlreadyRead.id);
      expect(ids).not.toContain(otherCustomerNotif.id);

      // Verify readAt is exposed in payload
      const readNotif = items.find((n: any) => n.id === customerNotifAlreadyRead.id);
      expect(readNotif.readAt).toBeDefined();
      expect(new Date(readNotif.readAt).toISOString()).toBe(originalReadAt.toISOString());
    });
  });

  describe("GET /api/v1/notifications/unread-count", () => {
    it("✓ Should return accurate unread count for the user", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/notifications/unread-count")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const body = res.body.data || res.body;
      // customerNotif1 and customerNotif2 are unread, customerNotifAlreadyRead is read
      expect(body.count).toBe(2);
    });
  });

  describe("PATCH /api/v1/notifications/:id/read", () => {
    it("✓ Should reject if notification belongs to another user (404 Not Found)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${otherCustomerNotif.id}/read`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(404);
    });

    it("✓ Should reject if notification does not exist (404 Not Found)", async () => {
      const res = await request(app.getHttpServer())
        .patch("/api/v1/notifications/00000000-0000-0000-0000-000000000000/read")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(404);
    });

    it("✓ Should mark unread notification as read", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${customerNotif1.id}/read`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const updated = await prisma.notification.findUnique({
        where: { id: customerNotif1.id },
      });
      expect(updated?.readAt).not.toBeNull();
    });

    it("✓ Should be idempotent when marking an already read notification", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${customerNotif1.id}/read`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
    });

    it("✓ Should reflect decreased unread count after single read", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/notifications/unread-count")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const body = res.body.data || res.body;
      // Only customerNotif2 remains unread
      expect(body.count).toBe(1);
    });
  });

  describe("PATCH /api/v1/notifications/read-all", () => {
    it("✓ Should mark all remaining unread notifications as read", async () => {
      const res = await request(app.getHttpServer())
        .patch("/api/v1/notifications/read-all")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);

      // Verify unread count is now 0
      const countRes = await request(app.getHttpServer())
        .get("/api/v1/notifications/unread-count")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(countRes.status).toBe(200);
      const countBody = countRes.body.data || countRes.body;
      expect(countBody.count).toBe(0);

      // Verify already-read notification timestamp was NOT overwritten
      const preservedNotif = await prisma.notification.findUnique({
        where: { id: customerNotifAlreadyRead.id },
      });
      expect(preservedNotif?.readAt?.toISOString()).toBe(originalReadAt.toISOString());

      // Verify other customer's notification remains unread
      const otherNotif = await prisma.notification.findUnique({
        where: { id: otherCustomerNotif.id },
      });
      expect(otherNotif?.readAt).toBeNull();
    });
  });
});

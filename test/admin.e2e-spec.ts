import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "@database/prisma/prisma.service";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaClientExceptionFilter } from "../src/common/filters/prisma-client-exception.filter";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import {
  AuditAction,
  BookingStatus,
  DocumentType,
  PaymentGateway,
  PaymentStatus,
  Role,
  ServiceMode,
  UserStatus,
  VerificationStatus,
} from "@prisma-client/enums";
import { Prisma } from "@prisma-client/client";
import { RedisService } from "@common/cache/redis.service";
import { AdminUserService } from "../src/modules/admin/services/admin-user.service";
import { AdminUserRepository } from "../src/modules/admin/repositories/admin-user.repository";

describe("Admin Platform Operations (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let redisService: RedisService;

  let adminUser: any;
  let adminToken: string;

  let customerUser: any;
  let customerToken: string;

  let providerUser: any;
  let providerProfile: any;
  let category: any;
  let service: any;
  let providerServiceOffering: any;
  let testBooking: any;
  let testPayment: any;
  let testReview: any;

  let pendingProviderUser: any;
  let pendingProviderProfile: any;
  let pendingDocument: any;

  let rejectedProviderUser: any;
  let rejectedProviderProfile: any;
  let rejectedDocument: any;

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
    app.useGlobalFilters(
      new HttpExceptionFilter(),
      new PrismaClientExceptionFilter(),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    redisService = app.get(RedisService);

    const ts = Date.now();
    const uid = Math.random().toString(36).substring(2, 7);
    const genPhone = () =>
      `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    // 1. Seed Admin User
    adminUser = await prisma.user.create({
      data: {
        email: `admin_${ts}_${uid}@servicehub.test`,
        passwordHash: "hash123",
        firstName: "System",
        lastName: "Admin",
        phone: genPhone(),
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    adminToken = await jwtService.signAsync({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });

    // 2. Seed Customer (Role.USER)
    customerUser = await prisma.user.create({
      data: {
        email: `customer_${ts}_${uid}@servicehub.test`,
        passwordHash: "hash123",
        firstName: "Normal",
        lastName: "Customer",
        phone: genPhone(),
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    customerToken = await jwtService.signAsync({
      sub: customerUser.id,
      email: customerUser.email,
      role: customerUser.role,
    });

    // 3. Seed Provider & Catalog for Booking test
    providerUser = await prisma.user.create({
      data: {
        email: `provider_${ts}_${uid}@servicehub.test`,
        passwordHash: "hash123",
        firstName: "Service",
        lastName: "Provider",
        phone: genPhone(),
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    providerProfile = await prisma.providerProfile.create({
      data: {
        userId: providerUser.id,
        businessName: "Clean Pro Services",
        experienceYears: 5,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });

    category = await prisma.category.create({
      data: {
        name: `Admin Test Category ${ts}`,
        slug: `admin-test-cat-${ts}`,
        isActive: true,
      },
    });

    service = await prisma.service.create({
      data: {
        categoryId: category.id,
        name: `Admin Deep Clean ${ts}`,
        slug: `admin-deep-clean-${ts}`,
        serviceMode: ServiceMode.AT_CUSTOMER_LOCATION,
        defaultDuration: 120,
        isActive: true,
      },
    });

    providerServiceOffering = await prisma.providerService.create({
      data: {
        providerId: providerProfile.id,
        serviceId: service.id,
        price: new Prisma.Decimal("1500.00"),
        durationMinutes: 120,
      },
    });

    testBooking = await prisma.booking.create({
      data: {
        customerId: customerUser.id,
        providerId: providerProfile.id,
        providerServiceId: providerServiceOffering.id,
        bookingDate: new Date(),
        startTime: new Date("1970-01-01T10:00:00Z"),
        endTime: new Date("1970-01-01T12:00:00Z"),
        bookingStatus: BookingStatus.CONFIRMED,
        bookedPrice: new Prisma.Decimal("1500.00"),
        bookedDuration: 120,
        bookedServiceMode: ServiceMode.AT_CUSTOMER_LOCATION,
        serviceName: service.name,
        providerBusinessName: providerProfile.businessName,
      },
    });

    testPayment = await prisma.payment.create({
      data: {
        bookingId: testBooking.id,
        gateway: PaymentGateway.RAZORPAY,
        gatewayOrderId: `order_${ts}_${uid}`,
        gatewayPaymentId: `pay_${ts}_${uid}`,
        amount: new Prisma.Decimal("1500.00"),
        currency: "INR",
        status: PaymentStatus.SUCCESS,
        paidAt: new Date(),
      },
    });

    testReview = await prisma.review.create({
      data: {
        bookingId: testBooking.id,
        customerId: customerUser.id,
        providerId: providerProfile.id,
        rating: 5,
        comment: "Outstanding service delivered on time!",
      },
    });

    // 4. Seed Pending Provider for Verification Tests
    pendingProviderUser = await prisma.user.create({
      data: {
        email: `pending_prov_${ts}_${uid}@servicehub.test`,
        passwordHash: "hash123",
        firstName: "Pending",
        lastName: "Provider",
        phone: genPhone(),
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    pendingProviderProfile = await prisma.providerProfile.create({
      data: {
        userId: pendingProviderUser.id,
        businessName: `Pending Services ${ts}`,
        experienceYears: 2,
        verificationStatus: VerificationStatus.PENDING,
      },
    });

    pendingDocument = await prisma.providerDocument.create({
      data: {
        providerId: pendingProviderProfile.id,
        documentType: DocumentType.AADHAAR,
        fileUrl: "https://storage.servicehub.test/docs/aadhaar.pdf",
        verificationStatus: VerificationStatus.PENDING,
      },
    });

    // 5. Seed Candidate Provider for Rejection Tests
    rejectedProviderUser = await prisma.user.create({
      data: {
        email: `reject_prov_${ts}_${uid}@servicehub.test`,
        passwordHash: "hash123",
        firstName: "Reject",
        lastName: "Candidate",
        phone: genPhone(),
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    rejectedProviderProfile = await prisma.providerProfile.create({
      data: {
        userId: rejectedProviderUser.id,
        businessName: `Reject Services ${ts}`,
        experienceYears: 1,
        verificationStatus: VerificationStatus.PENDING,
      },
    });

    rejectedDocument = await prisma.providerDocument.create({
      data: {
        providerId: rejectedProviderProfile.id,
        documentType: DocumentType.PAN,
        fileUrl: "https://storage.servicehub.test/docs/pan.pdf",
        verificationStatus: VerificationStatus.PENDING,
      },
    });
  });

  afterAll(async () => {
    // Teardown
    if (testBooking?.id) {
      await prisma.review
        .deleteMany({
          where: { bookingId: testBooking.id },
        })
        .catch(() => null);
      await prisma.payment
        .deleteMany({
          where: { bookingId: testBooking.id },
        })
        .catch(() => null);
      await prisma.booking
        .deleteMany({
          where: { id: testBooking.id },
        })
        .catch(() => null);
    }
    if (providerServiceOffering?.id) {
      await prisma.providerService
        .delete({
          where: { id: providerServiceOffering.id },
        })
        .catch(() => null);
    }
    if (service?.id) {
      await prisma.service
        .delete({
          where: { id: service.id },
        })
        .catch(() => null);
    }
    if (category?.id) {
      await prisma.category
        .delete({
          where: { id: category.id },
        })
        .catch(() => null);
    }

    const profileIds = [
      providerProfile?.id,
      pendingProviderProfile?.id,
      rejectedProviderProfile?.id,
    ].filter(Boolean);

    if (profileIds.length > 0) {
      await prisma.providerDocument
        .deleteMany({
          where: { providerId: { in: profileIds } },
        })
        .catch(() => null);
      await prisma.providerLocation
        .deleteMany({
          where: { providerId: { in: profileIds } },
        })
        .catch(() => null);
      await prisma.providerProfile
        .deleteMany({
          where: { id: { in: profileIds } },
        })
        .catch(() => null);
    }

    const userIds = [
      adminUser?.id,
      customerUser?.id,
      providerUser?.id,
      pendingProviderUser?.id,
      rejectedProviderUser?.id,
    ].filter(Boolean);

    if (userIds.length > 0) {
      await prisma.auditLog
        .deleteMany({
          where: {
            OR: [
              { actorUserId: { in: userIds } },
              { entityId: { in: profileIds } },
            ],
          },
        })
        .catch(() => null);
      await prisma.user
        .deleteMany({
          where: { id: { in: userIds } },
        })
        .catch(() => null);
    }

    await prisma.$disconnect();
    await app.close();
  });

  // =========================================================================
  describe("1. Security & RBAC Guard Enforcement", () => {
    const adminEndpoints = [
      { method: "get", path: "/api/v1/admin/dashboard" },
      { method: "get", path: "/api/v1/admin/users" },
      { method: "get", path: "/api/v1/admin/bookings" },
      { method: "get", path: "/api/v1/admin/providers" },
      { method: "get", path: "/api/v1/admin/payments" },
      { method: "get", path: "/api/v1/admin/audit-logs" },
    ];

    for (const ep of adminEndpoints) {
      it(`✓ ${ep.path} should reject unauthenticated requests (401 Unauthorized)`, async () => {
        const res = await (request(app.getHttpServer()) as any)[ep.method](
          ep.path,
        );
        expect(res.status).toBe(401);
      });

      it(`✓ ${ep.path} should reject non-admin users (403 Forbidden)`, async () => {
        const res = await (request(app.getHttpServer()) as any)
          [ep.method](ep.path)
          .set("Authorization", `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
      });

      it(`✓ ${ep.path} should allow admin user (200 OK)`, async () => {
        const res = await (request(app.getHttpServer()) as any)
          [ep.method](ep.path)
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
      });
    }
  });

  // =========================================================================
  describe("2. Admin Users Management (/api/v1/admin/users)", () => {
    it("✓ Should list users with pagination and NEVER leak passwordHash or refreshTokenHash", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/users?page=1&limit=10")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      const items = data.data || data.items;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);

      // Verify strict credential exclusion
      for (const u of items) {
        expect(u.passwordHash).toBeUndefined();
        expect(u.refreshTokenHash).toBeUndefined();
        expect(u).toHaveProperty("email");
        expect(u).toHaveProperty("role");
        expect(u).toHaveProperty("status");
      }
    });

    it("✓ Should fetch single user by ID with summary counts", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/users/${customerUser.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const user = res.body.data;
      expect(user.id).toBe(customerUser.id);
      expect(user.email).toBe(customerUser.email);
      expect(user._count).toBeDefined();
      expect(user._count.bookings).toBeGreaterThanOrEqual(1);
    });

    it("✓ Should allow admin to update customer status to BLOCKED", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${customerUser.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: UserStatus.BLOCKED });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.BLOCKED);

      // Verify in DB
      const updated = await prisma.user.findUnique({
        where: { id: customerUser.id },
      });
      expect(updated?.status).toBe(UserStatus.BLOCKED);
    });

    it("✓ Should reject if admin attempts to change their own status (400 Bad Request)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${adminUser.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: UserStatus.BLOCKED });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("own account status");
    });

    it("✓ Should filter users by role=PROVIDER and status=ACTIVE", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/users?role=PROVIDER&status=ACTIVE&page=1&limit=20")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(Array.isArray(items)).toBe(true);
      const found = items.find((u: any) => u.id === providerUser.id);
      expect(found).toBeDefined();
      expect(found.status).toBe(UserStatus.ACTIVE);
    });

    it("✓ Should filter users by exact email and phone", async () => {
      const emailRes = await request(app.getHttpServer())
        .get(`/api/v1/admin/users?email=${customerUser.email}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(emailRes.status).toBe(200);
      const emailItems = emailRes.body.data.data || emailRes.body.data.items;
      expect(emailItems.some((u: any) => u.email === customerUser.email)).toBe(
        true,
      );

      const phoneRes = await request(app.getHttpServer())
        .get(
          `/api/v1/admin/users?phone=${encodeURIComponent(customerUser.phone)}`,
        )
        .set("Authorization", `Bearer ${adminToken}`);

      expect(phoneRes.status).toBe(200);
      const phoneItems = phoneRes.body.data.data || phoneRes.body.data.items;
      expect(phoneItems.some((u: any) => u.phone === customerUser.phone)).toBe(
        true,
      );
    });

    it("✓ Should allow admin to suspend and reactivate a customer (ACTIVE -> SUSPENDED -> ACTIVE)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${customerUser.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: UserStatus.SUSPENDED });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.SUSPENDED);

      const updated = await prisma.user.findUnique({
        where: { id: customerUser.id },
      });
      expect(updated?.status).toBe(UserStatus.SUSPENDED);

      // Restore to ACTIVE
      const restoreRes = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${customerUser.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: UserStatus.ACTIVE });

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.data.status).toBe(UserStatus.ACTIVE);
    });

    it("✓ Should prevent suspending the final active admin (Invariant 2)", async () => {
      const adminService = app.get(AdminUserService);
      const adminRepo = app.get(AdminUserRepository);

      const spy = jest
        .spyOn(adminRepo, "countActiveAdmin")
        .mockResolvedValueOnce(1);

      await expect(
        adminService.updateStatus(
          adminUser.id,
          UserStatus.SUSPENDED,
          "00000000-0000-0000-0000-000000000001",
        ),
      ).rejects.toThrow(
        "Cannot suspend or deactivate the final active administrative account",
      );

      spy.mockRestore();
    });

    it("✓ Should allow suspending an admin when multiple active admins exist", async () => {
      const ts = Date.now();
      const secondAdmin = await prisma.user.create({
        data: {
          email: `admin2_${ts}@servicehub.test`,
          passwordHash: "hash123",
          firstName: "Second",
          lastName: "Admin",
          phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });

      try {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/admin/users/${secondAdmin.id}/status`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ status: UserStatus.SUSPENDED });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(UserStatus.SUSPENDED);
      } finally {
        await prisma.user
          .delete({ where: { id: secondAdmin.id } })
          .catch(() => null);
      }
    });
  });

  // =========================================================================
  describe("3. Admin Bookings (/api/v1/admin/bookings)", () => {
    it("✓ Should list platform-wide bookings including customer, provider, and payment summary", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/bookings?page=1&limit=50")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      const items = data.data || data.items;
      expect(Array.isArray(items)).toBe(true);

      const bookingItem = items.find((b: any) => b.id === testBooking.id);
      expect(bookingItem).toBeDefined();
      expect(bookingItem.customer).toBeDefined();
      expect(bookingItem.customer.email).toBe(customerUser.email);
      expect(bookingItem.customer.passwordHash).toBeUndefined();
      expect(bookingItem.customer.refreshTokenHash).toBeUndefined();
      expect(bookingItem.provider).toBeDefined();
      expect(bookingItem.provider.businessName).toBe(
        providerProfile.businessName,
      );
      expect(bookingItem.payments).toBeDefined();
      expect(Array.isArray(bookingItem.payments)).toBe(true);
      expect(
        bookingItem.payments.some(
          (p: any) => p.status === PaymentStatus.SUCCESS,
        ),
      ).toBe(true);
    });

    it("✓ Should filter bookings by status", async () => {
      const confirmedRes = await request(app.getHttpServer())
        .get(
          `/api/v1/admin/bookings?status=${BookingStatus.CONFIRMED}&customerId=${testBooking.customerId}`,
        )
        .set("Authorization", `Bearer ${adminToken}`);




      expect(confirmedRes.status).toBe(200);
      const items = confirmedRes.body.data.data || confirmedRes.body.data.items;
      expect(
        items.every((b: any) => b.bookingStatus === BookingStatus.CONFIRMED),
      ).toBe(true);
      expect(items.some((b: any) => b.id === testBooking.id)).toBe(true);

      const cancelledRes = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings?status=${BookingStatus.CANCELLED}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(cancelledRes.status).toBe(200);
      const cancelledItems =
        cancelledRes.body.data.data || cancelledRes.body.data.items;
      expect(cancelledItems.some((b: any) => b.id === testBooking.id)).toBe(
        false,
      );
    });

    it("✓ Should filter bookings by providerId", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings?providerId=${providerProfile.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.every((b: any) => b.providerId === providerProfile.id)).toBe(
        true,
      );
      expect(items.some((b: any) => b.id === testBooking.id)).toBe(true);
    });

    it("✓ Should filter bookings by customerId", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings?customerId=${customerUser.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.every((b: any) => b.customerId === customerUser.id)).toBe(
        true,
      );
      expect(items.some((b: any) => b.id === testBooking.id)).toBe(true);
    });

    it("✓ Should filter bookings by paymentStatus", async () => {
      const successRes = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings?paymentStatus=${PaymentStatus.SUCCESS}&customerId=${customerUser.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(successRes.status).toBe(200);
      const items = successRes.body.data.data || successRes.body.data.items;
      expect(items.some((b: any) => b.id === testBooking.id)).toBe(true);

      const refundedRes = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings?paymentStatus=${PaymentStatus.REFUNDED}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(refundedRes.status).toBe(200);
      const refundedItems =
        refundedRes.body.data.data || refundedRes.body.data.items;
      expect(refundedItems.some((b: any) => b.id === testBooking.id)).toBe(
        false,
      );
    });

    it("✓ Should filter bookings by date range (dateFrom and dateTo)", async () => {
      const today = new Date().toISOString().split("T")[0];
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings?dateFrom=${today}&dateTo=${today}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(items.some((b: any) => b.id === testBooking.id)).toBe(true);
    });

    it("✓ Should fetch deep booking detail by ID with Customer, Provider, Payment, Review, and Notifications", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings/${testBooking.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const booking = res.body.data;
      expect(booking.id).toBe(testBooking.id);
      expect(booking.serviceName).toBe(service.name);

      // Customer audit inspection without security leaks
      expect(booking.customer).toBeDefined();
      expect(booking.customer.id).toBe(customerUser.id);
      expect(booking.customer.email).toBe(customerUser.email);
      expect(booking.customer.phone).toBe(customerUser.phone);
      expect(booking.customer.passwordHash).toBeUndefined();
      expect(booking.customer.refreshTokenHash).toBeUndefined();

      // Provider audit inspection
      expect(booking.provider).toBeDefined();
      expect(booking.provider.id).toBe(providerProfile.id);
      expect(booking.provider.businessName).toBe(providerProfile.businessName);
      expect(booking.provider.user).toBeDefined();
      expect(booking.provider.user.email).toBe(providerUser.email);
      expect(booking.provider.user.passwordHash).toBeUndefined();

      // Payment investigation
      expect(Array.isArray(booking.payments)).toBe(true);
      expect(booking.payments.length).toBeGreaterThanOrEqual(1);
      const payment = booking.payments[0];
      expect(payment.status).toBe(PaymentStatus.SUCCESS);
      expect(payment.gateway).toBe(PaymentGateway.RAZORPAY);

      // Review investigation
      expect(booking.review).toBeDefined();
      expect(booking.review.rating).toBe(5);
      expect(booking.review.comment).toBe(
        "Outstanding service delivered on time!",
      );

      // Notifications list inspection
      expect(Array.isArray(booking.notifications)).toBe(true);
    });

    it("✓ Should return 400 Bad Request for malformed booking UUID", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/bookings/not-a-valid-uuid")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it("✓ Should return 404 Not Found for non-existent booking UUID", async () => {
      const nonExistentId = "a0000000-0000-0000-0000-000000000000";
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings/${nonExistentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  describe("4. Admin Dashboard (/api/v1/admin/dashboard)", () => {
    it("✓ Should return aggregated platform operational metrics matching Day 6 schema", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const dashboard = res.body.data;

      // 1. Users metrics
      expect(dashboard).toHaveProperty("users");
      expect(typeof dashboard.users.total).toBe("number");
      expect(typeof dashboard.users.customers).toBe("number");
      expect(typeof dashboard.users.providers).toBe("number");
      expect(dashboard.users.total).toBe(
        dashboard.users.customers + dashboard.users.providers,
      );
      expect(dashboard.users.total).toBeGreaterThanOrEqual(2);

      // 2. Providers verification metrics
      expect(dashboard).toHaveProperty("providers");
      expect(typeof dashboard.providers.pendingVerification).toBe("number");
      expect(typeof dashboard.providers.verified).toBe("number");
      expect(typeof dashboard.providers.suspended).toBe("number");
      expect(dashboard.providers.pendingVerification).toBeGreaterThanOrEqual(1);

      // 3. Bookings operational metrics
      expect(dashboard).toHaveProperty("bookings");
      expect(typeof dashboard.bookings.total).toBe("number");
      expect(typeof dashboard.bookings.today).toBe("number");
      expect(typeof dashboard.bookings.confirmed).toBe("number");
      expect(typeof dashboard.bookings.completed).toBe("number");
      expect(typeof dashboard.bookings.cancelled).toBe("number");
      expect(dashboard.bookings.total).toBeGreaterThanOrEqual(1);

      // 4. Payments metrics
      expect(dashboard).toHaveProperty("payments");
      expect(typeof dashboard.payments.successful).toBe("number");
      expect(typeof dashboard.payments.refunded).toBe("number");
      expect(dashboard.payments.successful).toBeGreaterThanOrEqual(1);

      // 5. Reviews metrics
      expect(dashboard).toHaveProperty("reviews");
      expect(typeof dashboard.reviews.total).toBe("number");
      expect(typeof dashboard.reviews.averageRating).toBe("number");
      expect(dashboard.reviews.total).toBeGreaterThanOrEqual(1);
      expect(dashboard.reviews.averageRating).toBe(5);

      // Revenue backward compatibility
      expect(dashboard).toHaveProperty("revenue");
      expect(typeof dashboard.revenue.totalVolume).toBe("number");
    });
  });

  // =========================================================================
  describe("5. Provider Verification & Operations (/api/v1/admin/providers)", () => {
    it("✓ GET /api/v1/admin/providers should list providers with verificationStatus filter", async () => {
      const res = await request(app.getHttpServer())
        .get(
          "/api/v1/admin/providers?verificationStatus=PENDING&page=1&limit=10",
        )
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      const items = data.data || data.items;
      expect(Array.isArray(items)).toBe(true);

      const found = items.find((p: any) => p.id === pendingProviderProfile.id);
      expect(found).toBeDefined();
      expect(found.verificationStatus).toBe(VerificationStatus.PENDING);
      expect(found.user).toBeDefined();
    });

    it("✓ GET /api/v1/admin/providers/:id should return provider detail with documents and user", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/providers/${pendingProviderProfile.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(pendingProviderProfile.id);
      expect(res.body.data.businessName).toBe(
        pendingProviderProfile.businessName,
      );
      expect(Array.isArray(res.body.data.documents)).toBe(true);
      expect(res.body.data.documents.length).toBeGreaterThanOrEqual(1);
    });

    it("✓ PATCH /api/v1/admin/providers/:id/suspend should reject if provider is not VERIFIED (400 Bad Request)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/providers/${pendingProviderProfile.id}/suspend`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        "Only VERIFIED providers can be suspended",
      );
    });

    it("✓ PATCH /api/v1/admin/providers/:id/verify should verify provider, invalidate Redis cache, and log audit event", async () => {
      const cacheKey = `provider:profile:${pendingProviderProfile.id}`;
      await redisService.set(cacheKey, JSON.stringify({ cached: true }), 300);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/providers/${pendingProviderProfile.id}/verify`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.verificationStatus).toBe(
        VerificationStatus.VERIFIED,
      );

      // Verify DB update
      const dbProfile = await prisma.providerProfile.findUnique({
        where: { id: pendingProviderProfile.id },
      });
      expect(dbProfile?.verificationStatus).toBe(VerificationStatus.VERIFIED);

      // Verify documents updated
      const doc = await prisma.providerDocument.findFirst({
        where: { providerId: pendingProviderProfile.id },
      });
      expect(doc?.verificationStatus).toBe(VerificationStatus.VERIFIED);

      // Verify Redis cache eviction
      const cached = await redisService.get(cacheKey);
      expect(cached).toBeNull();

      // Verify Audit Log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: pendingProviderProfile.id,
          action: AuditAction.PROVIDER_VERIFIED,
        },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.actorUserId).toBe(adminUser.id);
    });

    it("✓ PATCH /api/v1/admin/providers/:id/reject should require reason and fail if missing (400 Bad Request)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/providers/${rejectedProviderProfile.id}/reject`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("✓ PATCH /api/v1/admin/providers/:id/reject should reject provider, store rejection reason on documents, and log audit event", async () => {
      const reason = "Identity document could not be verified.";
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/providers/${rejectedProviderProfile.id}/reject`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason });

      expect(res.status).toBe(200);
      expect(res.body.data.verificationStatus).toBe(
        VerificationStatus.REJECTED,
      );

      // Verify DB profile status
      const dbProfile = await prisma.providerProfile.findUnique({
        where: { id: rejectedProviderProfile.id },
      });
      expect(dbProfile?.verificationStatus).toBe(VerificationStatus.REJECTED);

      // Verify rejectionReason saved on provider documents
      const doc = await prisma.providerDocument.findFirst({
        where: { providerId: rejectedProviderProfile.id },
      });
      expect(doc?.rejectionReason).toBe(reason);
      expect(doc?.verificationStatus).toBe(VerificationStatus.REJECTED);

      // Verify Audit Log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: rejectedProviderProfile.id,
          action: AuditAction.PROVIDER_REJECTED,
        },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.actorUserId).toBe(adminUser.id);
      expect((auditLog?.newValue as any)?.rejectReason).toBe(reason);
    });

    it("✓ PATCH /api/v1/admin/providers/:id/suspend should suspend verified provider, evict cache, and log audit event", async () => {
      const cacheKey = `provider:profile:${providerProfile.id}`;
      await redisService.set(cacheKey, JSON.stringify({ cached: true }), 300);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/providers/${providerProfile.id}/suspend`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.verificationStatus).toBe(
        VerificationStatus.SUSPENDED,
      );

      // Verify DB update
      const dbProfile = await prisma.providerProfile.findUnique({
        where: { id: providerProfile.id },
      });
      expect(dbProfile?.verificationStatus).toBe(VerificationStatus.SUSPENDED);

      // Verify Redis eviction
      const cached = await redisService.get(cacheKey);
      expect(cached).toBeNull();

      // Verify Audit Log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: providerProfile.id,
          action: AuditAction.PROVIDER_SUSPENDED,
        },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.actorUserId).toBe(adminUser.id);
    });

    it("✓ Invariant Check: Suspended provider is omitted from public marketplace search", async () => {
      const res = await request(app.getHttpServer()).get(
        "/api/v1/providers?page=1&limit=50",
      );

      expect(res.status).toBe(200);
      const items = res.body.data.items || res.body.data.data;
      const found = items.find((p: any) => p.id === providerProfile.id);
      expect(found).toBeUndefined();
    });

    it("✓ Invariant Check: Existing bookings for suspended provider remain intact", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings/${testBooking.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testBooking.id);
      expect(res.body.data.bookingStatus).toBe(BookingStatus.CONFIRMED);
    });

    it("✓ Invariant Check: New bookings for suspended provider are immediately blocked (400 Bad Request)", async () => {
      // Unblock customerUser in case previous test set status to BLOCKED
      await prisma.user.update({
        where: { id: customerUser.id },
        data: { status: UserStatus.ACTIVE },
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          providerServiceId: providerServiceOffering.id,
          startsAt: tomorrow.toISOString(),
          notes: "Attempting booking with suspended provider",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Provider profile is not verified");
    });
  });

  // =========================================================================
  describe("6. Admin Payment & Refund Operations (/api/v1/admin/payments)", () => {
    let pendingPaymentForTest: any;

    beforeAll(async () => {
      // Seed a CREATED/PENDING payment to test state machine restrictions
      const ts = Date.now();
      pendingPaymentForTest = await prisma.payment.create({
        data: {
          bookingId: testBooking.id,
          gateway: PaymentGateway.RAZORPAY,
          gatewayOrderId: `order_pending_${ts}`,
          amount: new Prisma.Decimal("500.00"),
          currency: "INR",
          status: PaymentStatus.PENDING,
        },
      });
    });

    afterAll(async () => {
      if (pendingPaymentForTest?.id) {
        await prisma.payment
          .deleteMany({
            where: { id: pendingPaymentForTest.id },
          })
          .catch(() => null);
      }
    });

    it("✓ Should list platform-wide payments with pagination, booking, customer, and provider info", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/payments?page=1&limit=50")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      const items = data.data || data.items;
      expect(Array.isArray(items)).toBe(true);

      const found = items.find((p: any) => p.id === testPayment.id);
      expect(found).toBeDefined();
      expect(found.status).toBe(PaymentStatus.SUCCESS);
      expect(found.booking).toBeDefined();
      expect(found.booking.customer).toBeDefined();
      expect(found.booking.customer.email).toBe(customerUser.email);
      expect(found.booking.customer.passwordHash).toBeUndefined();
      expect(found.booking.customer.refreshTokenHash).toBeUndefined();
      expect(found.booking.provider).toBeDefined();
      expect(found.booking.provider.businessName).toBe(
        providerProfile.businessName,
      );
    });

    it("✓ Should filter payments by status=SUCCESS", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/payments?status=${PaymentStatus.SUCCESS}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(items.every((p: any) => p.status === PaymentStatus.SUCCESS)).toBe(
        true,
      );
      expect(items.some((p: any) => p.id === testPayment.id)).toBe(true);
    });

    it("✓ Should filter payments by gateway=RAZORPAY", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/payments?gateway=${PaymentGateway.RAZORPAY}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(
        items.every((p: any) => p.gateway === PaymentGateway.RAZORPAY),
      ).toBe(true);
      expect(items.some((p: any) => p.id === testPayment.id)).toBe(true);
    });

    it("✓ Should filter payments by bookingId", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/payments?bookingId=${testBooking.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(items.every((p: any) => p.bookingId === testBooking.id)).toBe(
        true,
      );
      expect(items.some((p: any) => p.id === testPayment.id)).toBe(true);
    });

    it("✓ Should filter payments by date range (dateFrom and dateTo)", async () => {
      const today = new Date().toISOString().split("T")[0];
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/payments?dateFrom=${today}&dateTo=${today}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(items.some((p: any) => p.id === testPayment.id)).toBe(true);
    });

    it("✓ Should fetch deep payment investigation details by ID", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/payments/${testPayment.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const payment = res.body.data;
      expect(payment.id).toBe(testPayment.id);
      expect(payment.status).toBe(PaymentStatus.SUCCESS);
      expect(payment.booking).toBeDefined();
      expect(payment.booking.customer).toBeDefined();
      expect(payment.booking.customer.email).toBe(customerUser.email);
      expect(payment.booking.provider).toBeDefined();
    });

    it("✓ Should return 400 Bad Request for malformed payment UUID", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/payments/not-a-valid-uuid")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it("✓ Should return 404 Not Found for non-existent payment UUID", async () => {
      const nonExistentId = "b0000000-0000-0000-0000-000000000000";
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/payments/${nonExistentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it("✓ Refund Safety: Should reject refund if amount exceeds captured amount (400 Bad Request)", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/payments/${testPayment.id}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          amount: 50000.0, // captured is 1500.00
          reason: "Excessive refund amount test",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("cannot exceed captured");
    });

    it("✓ Refund Safety: Should reject refund if amount is zero or negative (400 Bad Request)", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/payments/${testPayment.id}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          amount: -50.0,
          reason: "Negative refund amount test",
        });

      expect(res.status).toBe(400);
    });

    it("✓ Refund Safety: Should reject refund for non-SUCCESS payments (400 Bad Request)", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/payments/${pendingPaymentForTest.id}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reason: "Attempting refund on PENDING payment",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        "Only SUCCESS payments can be refunded",
      );
    });

    it("✓ Should successfully refund a SUCCESS payment and update booking and audit log", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/payments/${testPayment.id}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reason: "Customer requested cancellation approved by admin",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.status).toBe(PaymentStatus.REFUNDED);
      expect(res.body.data.refundId).toBeDefined();

      // Verify DB payment status
      const updatedPayment = await prisma.payment.findUnique({
        where: { id: testPayment.id },
      });
      expect(updatedPayment?.status).toBe(PaymentStatus.REFUNDED);
      expect(updatedPayment?.refundedAt).toBeDefined();

      // Verify booking was transitioned to CANCELLED
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: testBooking.id },
      });
      expect(updatedBooking?.bookingStatus).toBe(BookingStatus.CANCELLED);
    });

    it("✓ Refund Idempotency: Attempting to refund an already refunded payment must be rejected", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/payments/${testPayment.id}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reason: "Second click on refund button",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Payment has already been refunded");
    });
  });

  // =========================================================================
  describe("7. Admin Hardening & Audit Trail (/api/v1/admin/audit-logs)", () => {
    let sampleAuditLogId: string;

    it("✓ Should list platform-wide audit logs with pagination and actorUser info", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/audit-logs?page=1&limit=50")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      const items = data.data || data.items;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);

      // Save an ID for single get
      sampleAuditLogId = items[0].id;

      // Verify structure matches Day 7 requirement
      const sample = items[0];
      expect(sample).toHaveProperty("id");
      expect(sample).toHaveProperty("action");
      expect(sample).toHaveProperty("entityType");
      expect(sample).toHaveProperty("entityId");
      expect(sample).toHaveProperty("createdAt");
      if (sample.actorUser) {
        expect(sample.actorUser).toHaveProperty("email");
        expect(sample.actorUser.passwordHash).toBeUndefined();
      }
    });

    it("✓ Should filter audit logs by action=PROVIDER_VERIFIED", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs?action=${AuditAction.PROVIDER_VERIFIED}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.every((l: any) => l.action === AuditAction.PROVIDER_VERIFIED)).toBe(true);
      expect(items.some((l: any) => l.entityId === pendingProviderProfile.id)).toBe(true);
    });

    it("✓ Should filter audit logs by action=PAYMENT_REFUNDED", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs?action=${AuditAction.PAYMENT_REFUNDED}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.every((l: any) => l.action === AuditAction.PAYMENT_REFUNDED)).toBe(true);
      expect(items.some((l: any) => l.entityId === testPayment.id)).toBe(true);
    });

    it("✓ Should filter audit logs by entityType=User", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/audit-logs?entityType=User")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(items.every((l: any) => l.entityType === "User")).toBe(true);
    });

    it("✓ Should filter audit logs by adminId", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs?adminId=${adminUser.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.every((l: any) => l.actorUserId === adminUser.id)).toBe(true);
    });

    it("✓ Should filter audit logs by date range (dateFrom and dateTo)", async () => {
      const today = new Date().toISOString().split("T")[0];
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs?dateFrom=${today}&dateTo=${today}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data || res.body.data.items;
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it("✓ Should fetch single audit log detail by ID", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs/${sampleAuditLogId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(sampleAuditLogId);
      expect(res.body.data.action).toBeDefined();
      expect(res.body.data.entityType).toBeDefined();
    });

    it("✓ Should return 400 Bad Request for malformed audit log UUID", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/audit-logs/not-a-valid-uuid")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it("✓ Should return 404 Not Found for non-existent audit log UUID", async () => {
      const nonExistentId = "c0000000-0000-0000-0000-000000000000";
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs/${nonExistentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it("✓ Audit Immutability: Should reject DELETE /api/v1/admin/audit-logs/:id (404 Not Found - Append Only)", async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admin/audit-logs/${sampleAuditLogId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it("✓ Audit Immutability: Should reject PATCH /api/v1/admin/audit-logs/:id (404 Not Found - Append Only)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/audit-logs/${sampleAuditLogId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ action: "ALTERED" });

      expect(res.status).toBe(404);
    });

    it("✓ Complete Week 8 Definition of Done: All state changes are auditable with adminId and metadata", async () => {
      const auditRes = await request(app.getHttpServer())
        .get("/api/v1/admin/audit-logs?page=1&limit=50")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(auditRes.status).toBe(200);
      const logs = auditRes.body.data.data || auditRes.body.data.items;

      const actionsPresent = logs.map((l: any) => l.action);
      expect(actionsPresent).toContain(AuditAction.PROVIDER_VERIFIED);
      expect(actionsPresent).toContain(AuditAction.PROVIDER_SUSPENDED);
      expect(actionsPresent).toContain(AuditAction.PAYMENT_REFUNDED);

      // Verify every admin log has actorUserId and timestamps
      for (const log of logs) {
        expect(log.id).toBeDefined();
        expect(log.createdAt).toBeDefined();
        expect(log.entityType).toBeDefined();
        expect(log.entityId).toBeDefined();
      }
    });
  });
});

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
  Role,
  ServiceMode,
  UserStatus,
  VerificationStatus,
} from "@prisma-client/enums";
import { Prisma } from "@prisma-client/client";
import { RedisService } from "@common/cache/redis.service";

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
      await prisma.booking.deleteMany({
        where: { id: testBooking.id },
      }).catch(() => null);
    }
    if (providerServiceOffering?.id) {
      await prisma.providerService.delete({
        where: { id: providerServiceOffering.id },
      }).catch(() => null);
    }
    if (service?.id) {
      await prisma.service.delete({
        where: { id: service.id },
      }).catch(() => null);
    }
    if (category?.id) {
      await prisma.category.delete({
        where: { id: category.id },
      }).catch(() => null);
    }

    const profileIds = [
      providerProfile?.id,
      pendingProviderProfile?.id,
      rejectedProviderProfile?.id,
    ].filter(Boolean);

    if (profileIds.length > 0) {
      await prisma.providerDocument.deleteMany({
        where: { providerId: { in: profileIds } },
      }).catch(() => null);
      await prisma.providerLocation.deleteMany({
        where: { providerId: { in: profileIds } },
      }).catch(() => null);
      await prisma.providerProfile.deleteMany({
        where: { id: { in: profileIds } },
      }).catch(() => null);
    }

    const userIds = [
      adminUser?.id,
      customerUser?.id,
      providerUser?.id,
      pendingProviderUser?.id,
      rejectedProviderUser?.id,
    ].filter(Boolean);

    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorUserId: { in: userIds } },
            { entityId: { in: profileIds } },
          ],
        },
      }).catch(() => null);
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      }).catch(() => null);
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
    ];

    for (const ep of adminEndpoints) {
      it(`✓ ${ep.path} should reject unauthenticated requests (401 Unauthorized)`, async () => {
        const res = await (request(app.getHttpServer()) as any)[ep.method](ep.path);
        expect(res.status).toBe(401);
      });

      it(`✓ ${ep.path} should reject non-admin users (403 Forbidden)`, async () => {
        const res = await (request(app.getHttpServer()) as any)[ep.method](ep.path)
          .set("Authorization", `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
      });

      it(`✓ ${ep.path} should allow admin user (200 OK)`, async () => {
        const res = await (request(app.getHttpServer()) as any)[ep.method](ep.path)
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
  });

  // =========================================================================
  describe("3. Admin Bookings (/api/v1/admin/bookings)", () => {
    it("✓ Should list platform-wide bookings including customer and provider info", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/bookings?page=1&limit=50")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      const items = data.data || data.items;
      expect(Array.isArray(items)).toBe(true);

      const bookingItem = items.find((b: any) => b.id === testBooking.id);
      if (bookingItem) {
        expect(bookingItem.customer).toBeDefined();
        expect(bookingItem.customer.email).toBe(customerUser.email);
        expect(bookingItem.provider).toBeDefined();
        expect(bookingItem.provider.businessName).toBe(providerProfile.businessName);
      } else {
        const single = await request(app.getHttpServer())
          .get(`/api/v1/admin/bookings/${testBooking.id}`)
          .set("Authorization", `Bearer ${adminToken}`);
        expect(single.status).toBe(200);
        expect(single.body.data.id).toBe(testBooking.id);
      }
    });

    it("✓ Should fetch booking detail by ID", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/bookings/${testBooking.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testBooking.id);
      expect(res.body.data.serviceName).toBe(service.name);
    });
  });

  // =========================================================================
  describe("4. Admin Dashboard (/api/v1/admin/dashboard)", () => {
    it("✓ Should return aggregated metrics across users, providers, bookings, and revenue", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const dashboard = res.body.data;

      expect(dashboard).toHaveProperty("users");
      expect(dashboard.users.total).toBeGreaterThanOrEqual(2);
      expect(dashboard.users).toHaveProperty("byStatus");

      expect(dashboard).toHaveProperty("providers");
      expect(dashboard.providers.total).toBeGreaterThanOrEqual(1);
      expect(dashboard.providers).toHaveProperty("byStatus");

      expect(dashboard).toHaveProperty("bookings");
      expect(dashboard.bookings.total).toBeGreaterThanOrEqual(1);
      expect(dashboard.bookings).toHaveProperty("byStatus");

      expect(dashboard).toHaveProperty("revenue");
      expect(typeof dashboard.revenue.totalVolume).toBe("number");
    });
  });

  // =========================================================================
  describe("5. Provider Verification & Operations (/api/v1/admin/providers)", () => {
    it("✓ GET /api/v1/admin/providers should list providers with verificationStatus filter", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/providers?verificationStatus=PENDING&page=1&limit=10")
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
      expect(res.body.data.businessName).toBe(pendingProviderProfile.businessName);
      expect(Array.isArray(res.body.data.documents)).toBe(true);
      expect(res.body.data.documents.length).toBeGreaterThanOrEqual(1);
    });

    it("✓ PATCH /api/v1/admin/providers/:id/suspend should reject if provider is not VERIFIED (400 Bad Request)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/providers/${pendingProviderProfile.id}/suspend`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Only VERIFIED providers can be suspended");
    });

    it("✓ PATCH /api/v1/admin/providers/:id/verify should verify provider, invalidate Redis cache, and log audit event", async () => {
      const cacheKey = `provider:profile:${pendingProviderProfile.id}`;
      await redisService.set(cacheKey, JSON.stringify({ cached: true }), 300);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/providers/${pendingProviderProfile.id}/verify`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.verificationStatus).toBe(VerificationStatus.VERIFIED);

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
      expect(res.body.data.verificationStatus).toBe(VerificationStatus.REJECTED);

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
      expect(res.body.data.verificationStatus).toBe(VerificationStatus.SUSPENDED);

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
      const res = await request(app.getHttpServer())
        .get("/api/v1/providers?page=1&limit=50");

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
});

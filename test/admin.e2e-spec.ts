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
  BookingStatus,
  Role,
  ServiceMode,
  UserStatus,
  VerificationStatus,
} from "@prisma-client/enums";
import { Prisma } from "@prisma-client/client";

describe("Admin Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

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

    const ts = Date.now();

    // 1. Seed Admin User
    adminUser = await prisma.user.create({
      data: {
        email: `admin_${ts}@servicehub.test`,
        passwordHash: "hash123",
        firstName: "System",
        lastName: "Admin",
        phone: `+91${ts.toString().slice(-10)}`,
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
        email: `customer_${ts}@servicehub.test`,
        passwordHash: "hash123",
        firstName: "Normal",
        lastName: "Customer",
        phone: `+91${(ts + 1).toString().slice(-10)}`,
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
        email: `provider_${ts}@servicehub.test`,
        passwordHash: "hash123",
        firstName: "Service",
        lastName: "Provider",
        phone: `+91${(ts + 2).toString().slice(-10)}`,
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
    if (providerProfile?.id) {
      await prisma.providerProfile.delete({
        where: { id: providerProfile.id },
      }).catch(() => null);
    }
    const userIds = [adminUser?.id, customerUser?.id, providerUser?.id].filter(Boolean);
    if (userIds.length > 0) {
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
        .get("/api/v1/admin/bookings?page=1&limit=10")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      const items = data.data || data.items;
      expect(Array.isArray(items)).toBe(true);

      const bookingItem = items.find((b: any) => b.id === testBooking.id);
      expect(bookingItem).toBeDefined();
      expect(bookingItem.customer).toBeDefined();
      expect(bookingItem.customer.email).toBe(customerUser.email);
      expect(bookingItem.provider).toBeDefined();
      expect(bookingItem.provider.businessName).toBe(providerProfile.businessName);
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
});

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/database/prisma/prisma.service";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { Role, VerificationStatus } from "../generated/prisma/client";

describe("Provider Onboarding (e2e)", () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let userToken: string;
  let adminToken: string;
  let providerId: string;

  const testUserEmail = "provider_e2e_user@example.com";
  const testUserPhone = "+919876543210";
  const testAdminEmail = "provider_e2e_admin@example.com";
  const testAdminPhone = "+919876543211";

  beforeAll(async () => {
    // 1. Create Nest Test Application with identical global configuration as main.ts
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
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    prismaService = app.get(PrismaService);

    // 2. Clear pre-existing test data
    await prismaService.providerDocument.deleteMany({
      where: {
        provider: {
          user: { email: { in: [testUserEmail, testAdminEmail] } },
        },
      },
    });
    await prismaService.providerLocation.deleteMany({
      where: {
        provider: {
          user: { email: { in: [testUserEmail, testAdminEmail] } },
        },
      },
    });
    await prismaService.providerProfile.deleteMany({
      where: {
        user: { email: { in: [testUserEmail, testAdminEmail] } },
      },
    });
    await prismaService.user.deleteMany({
      where: { email: { in: [testUserEmail, testAdminEmail] } },
    });

    // 3. Register standard user to obtain userToken
    const userRegRes = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testUserEmail,
        password: "Password123!",
        firstName: "Provider",
        lastName: "User",
        phone: testUserPhone,
      });

    expect(userRegRes.status).toBe(201);
    userToken = userRegRes.body.data.accessToken;

    // 4. Register admin user, promote role to ADMIN in DB, and login to obtain adminToken
    const adminRegRes = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testAdminEmail,
        password: "Password123!",
        firstName: "System",
        lastName: "Admin",
        phone: testAdminPhone,
      });

    expect(adminRegRes.status).toBe(201);

    await prismaService.user.update({
      where: { email: testAdminEmail },
      data: { role: Role.ADMIN },
    });

    const adminLoginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: testAdminEmail,
        password: "Password123!",
      });

    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.data.accessToken;
  }, 30000);

  // Test 1: Create Provider Profile
  it("POST /me/provider - should create provider profile", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/me/provider")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        businessName: "E2E Test Provider Services",
        description: "Professional home servicing and repair services.",
        experienceYears: 5,
        addressLine1: "123 Test Street",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.businessName).toBe("E2E Test Provider Services");

    providerId = res.body.data.id;
  });

  // Test 2: Duplicate Profile Protection
  it("POST /me/provider - should fail with 409 for duplicate profile", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/me/provider")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        businessName: "Another Provider Services",
        description:
          "Attempting to create second provider profile for same user.",
        experienceYears: 3,
        addressLine1: "456 Test Road",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400002",
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  // Test 3: Invalid Document Upload Validation
  it("POST /me/provider/documents - should fail with 400 for invalid file extension", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/me/provider/documents")
      .set("Authorization", `Bearer ${userToken}`)
      .attach("file", Buffer.from("malicious binary content"), "test.exe")
      .field("documentType", "LICENSE");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // Test 4: Admin Verify Provider
  it("PATCH /admin/providers/:id/verify - should verify provider profile", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/providers/${providerId}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verificationStatus).toBe(VerificationStatus.VERIFIED);
  });

  afterAll(async () => {
    // Clean up test database records created during test runs
    if (prismaService) {
      await prismaService.providerDocument.deleteMany({
        where: {
          provider: {
            user: { email: { in: [testUserEmail, testAdminEmail] } },
          },
        },
      });
      await prismaService.providerLocation.deleteMany({
        where: {
          provider: {
            user: { email: { in: [testUserEmail, testAdminEmail] } },
          },
        },
      });
      await prismaService.providerProfile.deleteMany({
        where: {
          user: { email: { in: [testUserEmail, testAdminEmail] } },
        },
      });
      await prismaService.user.deleteMany({
        where: { email: { in: [testUserEmail, testAdminEmail] } },
      });
    }

    if (app) {
      await app.close();
    }
  });
});

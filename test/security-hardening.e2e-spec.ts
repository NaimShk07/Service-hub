import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "../src/app.module";
import { PrismaService } from "@database/prisma/prisma.service";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaClientExceptionFilter } from "../src/common/filters/prisma-client-exception.filter";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { LoggingInterceptor } from "../src/common/interceptors/logging.interceptor";
import { TimeoutInterceptor } from "../src/common/interceptors/timeout.interceptor";
import { DocumentType, Role } from "@prisma-client/enums";
import { StorageService } from "../src/common/storage/storage.service";
import * as path from "path";
import * as bcrypt from "bcrypt";
import { Prisma } from "@prisma-client/client";
import { of } from "rxjs";
import { delay } from "rxjs/operators";

describe("Security & API Hardening Audit (e2e)", () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaService;
  let storageService: StorageService;

  let customerToken: string;
  let otherCustomerToken: string;
  let adminToken: string;
  let providerUserId: string;
  let providerProfileId: string;
  let providerToken: string;
  let uploadedDocId: string;

  const testUserIds: string[] = [];

  const genEmail = () =>
    `sec_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@servicehub.test`;
  const genPhone = () =>
    `+91${Math.floor(7000000000 + Math.random() * 2000000000)}`;

  beforeAll(async () => {
    // Note: In this security audit suite, we DO NOT mock ThrottlerGuard,
    // so we can test real rate limiting enforcement on abuse-prone routes!

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1", {
      exclude: ["health", "health/(.*)", "api/v1/health", "api/v1/health/(.*)"],
    });
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
    app.useGlobalInterceptors(
      new TimeoutInterceptor(30000),
      new TransformInterceptor(),
      new LoggingInterceptor(),
    );

    app.getHttpAdapter().getInstance().set("trust proxy", true);
    await app.init();
    prisma = app.get(PrismaService);
    storageService = app.get(StorageService);

    // 1. Create Customer 1
    const cust1Email = genEmail();
    const cust1Res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: cust1Email,
        password: "StrongPassword123!",
        firstName: "Security",
        lastName: "Customer1",
        phone: genPhone(),
      });
    customerToken = cust1Res.body.data.accessToken;
    testUserIds.push(cust1Res.body.data.user.id);

    // 2. Create Customer 2 (attacker/unauthorized)
    const cust2Email = genEmail();
    const cust2Res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: cust2Email,
        password: "StrongPassword123!",
        firstName: "Attacker",
        lastName: "Customer2",
        phone: genPhone(),
      });
    otherCustomerToken = cust2Res.body.data.accessToken;
    testUserIds.push(cust2Res.body.data.user.id);

    // 3. Create Provider User & Profile
    const provEmail = genEmail();
    const provRes = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: provEmail,
        password: "StrongPassword123!",
        firstName: "Verified",
        lastName: "Provider",
        phone: genPhone(),
      });
    providerToken = provRes.body.data.accessToken;
    providerUserId = provRes.body.data.user.id;
    testUserIds.push(providerUserId);

    const profileRes = await request(app.getHttpServer())
      .post("/api/v1/me/provider")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        businessName: `Secured Pro Services ${Date.now()}`,
        description: "Hardened provider profile",
        experienceYears: 5,
        addressLine1: "123 Secure Street",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
      });
    expect(profileRes.status).toBe(201);
    providerProfileId = profileRes.body.data.id;

    // 4. Create Admin User
    const adminEmail = genEmail();
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        phone: genPhone(),
        passwordHash: await bcrypt.hash("AdminPassword123!", 10),
        firstName: "Sec",
        lastName: "Admin",
        role: Role.ADMIN,
      },
    });
    testUserIds.push(adminUser.id);

    const adminLoginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: adminEmail,
        password: "AdminPassword123!",
      });
    adminToken = adminLoginRes.body.data.accessToken;

    // 5. Provider uploads a verification document
    const uploadRes = await request(app.getHttpServer())
      .post("/api/v1/me/provider/documents")
      .set("Authorization", `Bearer ${providerToken}`)
      .attach(
        "file",
        Buffer.from("%PDF-1.4 Mock confidential provider tax certificate"),
        "license.pdf",
      )
      .field("documentType", DocumentType.BUSINESS_LICENSE);

    expect(uploadRes.status).toBe(201);
    uploadedDocId = uploadRes.body.data.id;
  });

  afterAll(async () => {
    if (testUserIds.length > 0) {
      await prisma.providerDocument
        .deleteMany({
          where: { providerId: providerProfileId },
        })
        .catch(() => null);

      await prisma.providerProfile
        .deleteMany({
          where: { id: providerProfileId },
        })
        .catch(() => null);

      await prisma.user
        .deleteMany({
          where: { id: { in: testUserIds } },
        })
        .catch(() => null);
    }

    await prisma.$disconnect();
    await app.close();
  });

  describe("1. Rate Limiting Protection on Abuse-Prone Endpoints", () => {
    it("should throttle excessive failed login attempts (limit: 5 req/min)", async () => {
      const email = `throttle_login_${Date.now()}@servicehub.test`;

      const attempts: number[] = [];
      for (let i = 0; i < 7; i++) {
        const res = await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", "198.51.100.1")
          .send({
            email,
            password: "WrongPassword123!",
          });
        attempts.push(res.status);
      }

      // First 5 attempts return 401 Unauthorized; subsequent attempts return 429 Too Many Requests
      expect(attempts.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(attempts[5]).toBe(429);
      expect(attempts[6]).toBe(429);
    });

    it("should throttle excessive registration attempts (limit: 5 req/min)", async () => {
      const attempts: number[] = [];
      for (let i = 0; i < 7; i++) {
        const res = await request(app.getHttpServer())
          .post("/api/v1/auth/register")
          .set("X-Forwarded-For", "198.51.100.2")
          .send({
            email: `throttle_reg_${Date.now()}_${i}@servicehub.test`,
            password: "StrongPassword123!",
            firstName: "Rate",
            lastName: "Limit",
            phone: genPhone(),
          });
        attempts.push(res.status);
        if (res.body?.data?.user?.id) {
          testUserIds.push(res.body.data.user.id);
        }
      }

      // First 5 should succeed (201), remaining should be 429
      expect(attempts.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
      expect(attempts[5]).toBe(429);
      expect(attempts[6]).toBe(429);
    });
  });

  describe("2. DTO Validation & Unexpected Input Rejection", () => {
    it("should reject requests containing non-whitelisted/unexpected properties (forbidNonWhitelisted)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .set("X-Forwarded-For", "198.51.100.3")
        .send({
          email: genEmail(),
          password: "StrongPassword123!",
          firstName: "Valid",
          lastName: "User",
          phone: genPhone(),
          isAdmin: true, // Malicious privilege escalation field
          role: "ADMIN",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.message)).toContain("should not exist");
    });

    it("should reject malformed UUID route parameters with 400 Bad Request", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/bookings/not-a-valid-uuid")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.message)).toContain(
        "Validation failed (uuid is expected)",
      );
    });
  });

  describe("3. Pagination Limits & Protection Against Expensive Queries", () => {
    it("should reject excessively large limit values (> 50/100) with 400 Bad Request", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/bookings?limit=999999")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.message)).toContain(
        "limit must not be greater than",
      );
    });

    it("should reject negative or zero page query parameter", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/bookings?page=0")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.message)).toContain(
        "page must not be less than 1",
      );
    });
  });

  describe("4. Security Headers (Helmet)", () => {
    it("should return standard security headers on all responses", async () => {
      const res = await request(app.getHttpServer()).get("/health/live");

      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(res.headers["strict-transport-security"]).toBeDefined();
    });
  });

  describe("5. Information Disclosure & Production Error Sanitization", () => {
    it("should not expose database column names or internal SQL errors in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      try {
        // Trigger a database unique constraint conflict
        const existingEmail = genEmail();
        const existingPhone = genPhone();
        const createdUser = await prisma.user.create({
          data: {
            email: existingEmail,
            phone: existingPhone,
            passwordHash: "hash123",
            firstName: "A",
            lastName: "B",
            role: Role.USER,
          },
        });
        testUserIds.push(createdUser.id);

        // Simulating error filter with production flag
        const res = await request(app.getHttpServer())
          .post("/api/v1/auth/register")
          .send({
            email: existingEmail,
            password: "StrongPassword123!",
            firstName: "Duplicate",
            lastName: "User",
            phone: genPhone(),
          });

        expect(res.status).toBe(400);
        expect(res.body.message).not.toContain("users_email_key");
        expect(res.body.message).not.toContain("SELECT");
        expect(res.body.message).not.toContain("INSERT");

        // Verify PrismaClientExceptionFilter explicitly in production mode
        const filter = new PrismaClientExceptionFilter();
        const mockJson = jest.fn();
        const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
        const mockHost = {
          switchToHttp: () => ({
            getResponse: () => ({ status: mockStatus }),
            getRequest: () => ({
              method: "POST",
              url: "/api/test",
              requestId: "req-sec-1",
            }),
          }),
        } as any;

        const p2002Err = new Prisma.PrismaClientKnownRequestError(
          "Unique constraint failed on the fields: (`email`)",
          {
            code: "P2002",
            clientVersion: "7.0.0",
            meta: { target: ["email"] },
          },
        );
        filter.catch(p2002Err, mockHost);
        expect(mockStatus).toHaveBeenCalledWith(409);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: "A duplicate record already exists.",
            requestId: "req-sec-1",
          }),
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe("6. Safe Handling of Uploaded Provider Documents & IDOR Protection", () => {
    it("should prevent direct unauthenticated static access to /uploads/documents (404)", async () => {
      const res = await request(app.getHttpServer()).get(
        "/uploads/documents/any-confidential-license.pdf",
      );

      // Since ServeStaticModule only serves /uploads/public, /uploads/documents is unreachable!
      expect(res.status).toBe(404);
    });

    it("should reject unauthenticated access to document file endpoint (401 Unauthorized)", async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/provider/documents/${uploadedDocId}/file`,
      );

      expect(res.status).toBe(401);
    });

    it("should reject non-owner customer or unauthorized user from viewing provider document (403 Forbidden)", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/provider/documents/${uploadedDocId}/file`)
        .set("Authorization", `Bearer ${otherCustomerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain(
        "You do not have permission to access this document",
      );
    });

    it("should allow the document owner provider to download their document (200 OK)", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/provider/documents/${uploadedDocId}/file`)
        .set("Authorization", `Bearer ${providerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.body.toString("utf8")).toContain(
        "Mock confidential provider tax certificate",
      );
    });

    it("should allow Admin to view and download any provider document (200 OK)", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/provider/documents/${uploadedDocId}/file`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.body.toString("utf8")).toContain(
        "Mock confidential provider tax certificate",
      );
    });

    it("should prevent path traversal attacks in LocalStorageService", () => {
      expect(() => {
        storageService.getFilePath("/uploads/../../../../etc/passwd");
      }).toThrow(BadRequestException);

      expect(() => {
        storageService.getFilePath("/uploads/../package.json");
      }).toThrow("path traversal detected");
    });
  });

  describe("7. Request Timeouts", () => {
    it("TimeoutInterceptor should throw 408 Request Timeout when processing exceeds limit", async () => {
      const interceptor = new TimeoutInterceptor(50); // 50ms timeout for test

      const mockContext = {} as ExecutionContext;
      const mockHandler: CallHandler = {
        handle: () => of("success").pipe(delay(200)), // delays 200ms
      };

      await expect(
        interceptor.intercept(mockContext, mockHandler).toPromise(),
      ).rejects.toThrow("Request processing timed out");
    });
  });
});

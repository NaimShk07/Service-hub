import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { PrismaService } from "@database/prisma/prisma.service";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaClientExceptionFilter } from "../src/common/filters/prisma-client-exception.filter";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { Role } from "@prisma-client/enums";

describe("Authentication & Session Reliability (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUserIds: string[] = [];

  const genEmail = () => `auth_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@servicehub.test`;
  const genPhone = () => `+91${Math.floor(7000000000 + Math.random() * 2000000000)}`;

  beforeAll(async () => {
    jest.spyOn(ThrottlerGuard.prototype, "canActivate").mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
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
  });

  afterAll(async () => {
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      }).catch(() => null);
    }
    await prisma.$disconnect();
    await app.close();
  });

  describe("1. User Registration Flow", () => {
    const validRegistration = {
      email: genEmail(),
      password: "StrongPassword123!",
      firstName: "Test",
      lastName: "User",
      phone: genPhone(),
      role: Role.USER,
    };

    it("✓ Should register user successfully, set refreshToken cookie, and not leak password hashes", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(validRegistration);

      expect(res.status).toBe(201);
      const data = res.body.data;
      expect(data).toHaveProperty("accessToken");
      expect(typeof data.accessToken).toBe("string");
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(validRegistration.email);
      expect(data.user.passwordHash).toBeUndefined();
      expect(data.user.refreshTokenHash).toBeUndefined();

      testUserIds.push(data.user.id);

      // Verify httpOnly refreshToken cookie is set
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const hasRefreshCookie = cookies.some((c: string) => c.includes("refreshToken="));
      expect(hasRefreshCookie).toBe(true);
    });

    it("✓ Should reject registration with duplicate email (400 Bad Request)", async () => {
      const duplicateEmailPayload = {
        ...validRegistration,
        phone: genPhone(), // unique phone, duplicate email
      };

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(duplicateEmailPayload);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("already exists");
    });

    it("✓ Should reject registration with duplicate phone (400 Bad Request)", async () => {
      const duplicatePhonePayload = {
        ...validRegistration,
        email: genEmail(), // unique email, duplicate phone
      };

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(duplicatePhonePayload);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("already exists");
    });

    it("✓ Should reject registration with invalid email or weak password (400 Bad Request)", async () => {
      const invalidPayload = {
        email: "not-an-email",
        password: "123", // too short
        firstName: "",
        lastName: "",
        phone: "invalid",
      };

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(invalidPayload);

      expect(res.status).toBe(400);
    });
  });

  describe("2. Authentication & Login Flow", () => {
    const userCredentials = {
      email: genEmail(),
      password: "CorrectPassword123!",
      firstName: "Login",
      lastName: "Tester",
      phone: genPhone(),
      role: Role.USER,
    };

    beforeAll(async () => {
      const reg = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(userCredentials);
      testUserIds.push(reg.body.data.user.id);
    });

    it("✓ Should login successfully with correct credentials and return accessToken + refresh cookie", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: userCredentials.email,
          password: userCredentials.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(userCredentials.email);

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes("refreshToken="))).toBe(true);
    });

    it("✓ Should reject login with wrong password (401 Unauthorized)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: userCredentials.email,
          password: "WrongPassword123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Invalid email or password");
    });

    it("✓ Should reject login with non-existent email without leaking user existence (401 Unauthorized)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: "non_existent_account_12345@servicehub.test",
          password: "AnyPassword123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Invalid email or password");
    });
  });

  describe("3. Session Profile (/auth/me)", () => {
    let validAccessToken: string;
    let userId: string;

    beforeAll(async () => {
      const reg = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: genEmail(),
          password: "MyPassword123!",
          firstName: "Profile",
          lastName: "Check",
          phone: genPhone(),
          role: Role.USER,
        });
      validAccessToken = reg.body.data.accessToken;
      userId = reg.body.data.user.id;
      testUserIds.push(userId);
    });

    it("✓ Should return current authenticated user profile when token is valid", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(userId);
      expect(res.body.data.firstName).toBe("Profile");
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it("✓ Should reject requests with missing Authorization header (401 Unauthorized)", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/me");

      expect(res.status).toBe(401);
    });

    it("✓ Should reject requests with tampered or invalid JWT (401 Unauthorized)", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature");

      expect(res.status).toBe(401);
    });
  });

  describe("4. Refresh Token Rotation & Session Revocation", () => {
    let initialRefreshTokenCookie: string;
    let currentAccessToken: string;
    let userId: string;

    beforeAll(async () => {
      const reg = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: genEmail(),
          password: "RotationPassword123!",
          firstName: "Refresh",
          lastName: "Rotate",
          phone: genPhone(),
          role: Role.USER,
        });
      currentAccessToken = reg.body.data.accessToken;
      userId = reg.body.data.user.id;
      testUserIds.push(userId);

      const cookies = reg.headers["set-cookie"] as unknown as string[];
      initialRefreshTokenCookie = cookies.find((c: string) => c.startsWith("refreshToken=")) || "";
    });

    it("✓ Should successfully refresh access token and rotate the refreshToken cookie", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", [initialRefreshTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();

      // Ensure rotated cookie was returned
      const newCookies = res.headers["set-cookie"] as unknown as string[];
      expect(newCookies).toBeDefined();
      const rotatedCookie = newCookies.find((c: string) => c.startsWith("refreshToken="));
      expect(rotatedCookie).toBeDefined();
    });

    it("✓ Should reject refresh attempt without refresh token cookie (401 Unauthorized)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh");

      expect(res.status).toBe(401);
    });

    it("✓ Should logout user, clear cookie, and revoke session", async () => {
      const logoutRes = await request(app.getHttpServer())
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${currentAccessToken}`);

      expect(logoutRes.status).toBe(200);

      // Verify DB refreshTokenHash is cleared
      const userInDb = await prisma.user.findUnique({ where: { id: userId } });
      expect(userInDb?.refreshTokenHash).toBeNull();
    });

    it("✓ Should reject refresh attempt after logout (session revoked)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", [initialRefreshTokenCookie]);

      expect(res.status).toBe(401);
    });
  });
});

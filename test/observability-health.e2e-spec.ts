import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { PrismaService } from "@database/prisma/prisma.service";
import { RedisService } from "@common/cache/redis.service";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaClientExceptionFilter } from "../src/common/filters/prisma-client-exception.filter";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { LoggingInterceptor } from "../src/common/interceptors/logging.interceptor";
import { sanitizeLogData } from "../src/common/logging/sanitizer.util";
import { AppLogger } from "../src/common/logging/app.logger";
import { requestContext } from "../src/common/logging/request-context";

describe("Observability, Request Correlation & Health Checks (e2e)", () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaService;
  let redisService: RedisService;

  beforeAll(async () => {
    jest.spyOn(ThrottlerGuard.prototype, "canActivate").mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1", {
      exclude: ["health", "health/(.*)", "api/v1/health", "api/v1/health/(.*)"],
    });

    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(
      new HttpExceptionFilter(),
      new PrismaClientExceptionFilter(),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalInterceptors(new LoggingInterceptor());

    await app.init();
    prisma = app.get(PrismaService);
    redisService = app.get(RedisService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe("1. Health Checks Probes (/health/live & /health/ready)", () => {
    it("GET /health/live should return 200 OK with process uptime", async () => {
      const res = await request(app.getHttpServer()).get("/health/live");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(typeof res.body.uptime).toBe("number");
      expect(res.body.uptime).toBeGreaterThan(0);
      expect(res.body.timestamp).toBeDefined();
    });

    it("GET /api/v1/health/live should also work via prefix route", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/health/live");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("GET /health/ready should return 200 OK when database is responsive", async () => {
      const res = await request(app.getHttpServer()).get("/health/ready");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.info.database.status).toBe("up");
      expect(res.body.details.database.status).toBe("up");
    });

    it("GET /health/ready should return 503 Service Unavailable when database fails", async () => {
      jest
        .spyOn(prisma, "$queryRaw")
        .mockRejectedValueOnce(new Error("Connection terminated unexpectedly"));

      const res = await request(app.getHttpServer()).get("/health/ready");

      expect(res.status).toBe(503);
      expect(res.body.status).toBe("error");
      expect(res.body.error.database.status).toBe("down");
      expect(res.body.error.database.error).toContain(
        "Connection terminated unexpectedly",
      );
    });

    it("GET /health/ready should remain 200 OK (degraded) when Redis is offline", async () => {
      jest.spyOn(redisService, "ping").mockResolvedValueOnce(false);

      const res = await request(app.getHttpServer()).get("/health/ready");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.details.redis.connected).toBe(false);
      expect(res.body.details.redis.degraded).toBe(true);
    });
  });

  describe("2. Request ID Correlation & Propagation", () => {
    it("should generate X-Request-ID when not provided by client", async () => {
      const res = await request(app.getHttpServer()).get("/health/live");

      expect(res.status).toBe(200);
      const reqId = res.headers["x-request-id"];
      expect(reqId).toBeDefined();
      expect(reqId).toMatch(/^req_[a-f0-9-]+$/);
    });

    it("should accept, safely validate, and echo a valid client-provided X-Request-ID", async () => {
      const customId = "client-trace-12345_abc";
      const res = await request(app.getHttpServer())
        .get("/health/live")
        .set("X-Request-ID", customId);

      expect(res.status).toBe(200);
      expect(res.headers["x-request-id"]).toBe(customId);
    });

    it("should reject malicious or oversized incoming X-Request-ID and generate a safe fallback", async () => {
      const maliciousId = "invalid!@#$%;DROP TABLE users;--" + "A".repeat(100);
      const res = await request(app.getHttpServer())
        .get("/health/live")
        .set("X-Request-ID", maliciousId);

      expect(res.status).toBe(200);
      expect(res.headers["x-request-id"]).not.toBe(maliciousId);
      expect(res.headers["x-request-id"]).toMatch(/^req_[a-f0-9-]+$/);
    });

    it("should include X-Request-ID in error response headers and response body", async () => {
      const clientTraceId = "err-trace-999";
      const res = await request(app.getHttpServer())
        .get("/api/v1/non-existent-endpoint-404")
        .set("X-Request-ID", clientTraceId);

      expect(res.status).toBe(404);
      expect(res.headers["x-request-id"]).toBe(clientTraceId);
      expect(res.body.requestId).toBe(clientTraceId);
      expect(res.body.statusCode).toBe(404);
    });
  });

  describe("3. Structured Logging & PII Sanitization", () => {
    it("should redact sensitive fields (passwords, tokens, secrets, card numbers)", () => {
      const rawPayload = {
        email: "customer@example.com",
        password: "SuperSecretPassword123!",
        refreshToken: "eyJhbGciOi...",
        accessToken: "eyJhbGciOi...",
        authorization: "Bearer eyJhbGciOi...",
        cardNumber: "4111222233334444",
        cvv: "123",
        razorpay_signature: "sec_987654321",
        nested: {
          token: "secret-token",
          safeKey: "safeValue",
        },
      };

      const sanitized = sanitizeLogData(rawPayload);

      expect(sanitized.email).toBe("customer@example.com");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.refreshToken).toBe("[REDACTED]");
      expect(sanitized.accessToken).toBe("[REDACTED]");
      expect(sanitized.authorization).toBe("[REDACTED]");
      expect(sanitized.cardNumber).toBe("[REDACTED]");
      expect(sanitized.cvv).toBe("[REDACTED]");
      expect(sanitized.razorpay_signature).toBe("[REDACTED]");
      expect(sanitized.nested.token).toBe("[REDACTED]");
      expect(sanitized.nested.safeKey).toBe("safeValue");
    });

    it("should redact Bearer tokens inside raw log strings", () => {
      const rawString =
        "User authenticated with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload";
      const sanitized = sanitizeLogData(rawString);

      expect(sanitized).toBe("User authenticated with Bearer [REDACTED]");
    });

    it("AppLogger should emit machine-readable JSON with correlation fields", () => {
      const logger = new AppLogger("BookingService");
      let output = "";
      const writeSpy = jest
        .spyOn(process.stdout, "write")
        .mockImplementation((chunk: any) => {
          output += chunk;
          return true;
        });

      requestContext.run({ requestId: "req_booking_trace_01" }, () => {
        logger.log("Booking confirmed", { bookingId: "book_test_123" });
      });

      writeSpy.mockRestore();

      expect(output).toBeTruthy();
      const parsed = JSON.parse(output.trim());
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Booking confirmed");
      expect(parsed.requestId).toBe("req_booking_trace_01");
      expect(parsed.bookingId).toBe("book_test_123");
      expect(parsed.context).toBe("BookingService");
      expect(parsed.timestamp).toBeDefined();
    });
  });
});

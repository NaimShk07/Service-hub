import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/database/prisma/prisma.service";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { RedisService } from "../src/common/cache/redis.service";

describe("Provider Search & Marketplace (e2e)", () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let redisService: RedisService;

  beforeAll(async () => {
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
    redisService = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/providers - should return paginated summary list of providers", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/providers?page=1&limit=10")
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("items");
    expect(res.body.data).toHaveProperty("meta");
    expect(res.body.data.meta.page).toBe(1);
    expect(res.body.data.meta.limit).toBe(10);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it("GET /api/v1/providers - should filter by city and minRating", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/providers?city=Mumbai&minRating=4")
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    res.body.data.items.forEach((item: any) => {
      expect(item.averageRating).toBeGreaterThanOrEqual(4);
    });
  });

  it("GET /api/v1/providers - should handle text search query", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/providers?search=clean")
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it("GET /api/v1/providers - should sort by price_asc", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/providers?sort=price_asc")
      .expect(200);

    expect(res.body.success).toBe(true);
    const items = res.body.data.items;
    for (let i = 0; i < items.length - 1; i++) {
      if (
        items[i].startingPrice !== null &&
        items[i + 1].startingPrice !== null
      ) {
        expect(items[i].startingPrice).toBeLessThanOrEqual(
          items[i + 1].startingPrice,
        );
      }
    }
  });

  it("GET /api/v1/providers - should fail validation for invalid minRating", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/providers?minRating=10")
      .expect(400);
  });

  it("Redis Fallback - should not fail API request when Redis is offline or miss occurs", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/providers?city=NonExistentCity999")
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBe(0);
  });
});

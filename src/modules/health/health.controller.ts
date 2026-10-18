import { PrismaService } from "@database/prisma/prisma.service";
import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult,
} from "@nestjs/terminus";
import { RedisService } from "@common/cache/redis.service";

@Controller(["health", "api/v1/health"])
@ApiTags("Health")
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Liveness probe: verifies that the application process is running.
   */
  @Get("live")
  @ApiOperation({ summary: "Liveness probe - checks if process is alive" })
  @ApiResponse({
    status: 200,
    description: "Application process is running",
  })
  live() {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe: verifies that the application can serve requests,
   * checking required dependencies (PostgreSQL database and Redis cache).
   */
  @HealthCheck()
  @Get("ready")
  @ApiOperation({
    summary: "Readiness probe - checks database and cache dependencies",
  })
  @ApiResponse({
    status: 200,
    description: "System is ready to serve traffic",
  })
  @ApiResponse({
    status: 503,
    description: "Service unavailable - critical dependency is down",
  })
  async ready() {
    return await this.healthCheckService.check([
      // 1. Critical Dependency: PostgreSQL Database (hard dependency)
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.prismaService.$queryRaw`SELECT 1`;
          return { database: { status: "up" } };
        } catch (error: any) {
          throw new HealthCheckError("PostgreSQL check failed", {
            database: { status: "down", error: error.message },
          });
        }
      },
      // 2. Auxiliary Dependency: Redis Cache (gracefully degraded if down)
      async (): Promise<HealthIndicatorResult> => {
        const isRedisUp = await this.redisService.ping();
        return {
          redis: {
            status: "up",
            connected: isRedisUp,
            ...(isRedisUp
              ? {}
              : { degraded: true, note: "Redis offline - caching degraded" }),
          },
        };
      },

    ]);
  }


  /**
   * General health endpoint (backwards compatible alias to ready)
   */
  @HealthCheck()
  @Get()
  @ApiOperation({ summary: "General health check" })
  async health() {
    return await this.ready();
  }
}

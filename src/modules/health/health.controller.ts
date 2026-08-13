import { PrismaService } from "@database/prisma/prisma.service";
import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";

@Controller("health")
@ApiTags("Health")
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly prismaService: PrismaService,
  ) {}

  @HealthCheck()
  @Get()
  @ApiOperation({ summary: "System health & database check" })
  @ApiResponse({
    status: 200,
    description: "System is healthy and database is connected",
  })
  @ApiResponse({
    status: 503,
    description: "Service unavailable / Database connection issue",
  })
  async health() {
    return await this.healthCheckService.check([
      async () => {
        await this.prismaService.$queryRaw`SELECT 1`;
        return { database: { status: "up" } };
      },
    ]);
  }
}

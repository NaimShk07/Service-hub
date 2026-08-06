import { PrismaService } from "@database/prisma/prisma.service";
import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
} from "@nestjs/terminus";

@Controller("health")
@ApiTags("health")
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly prismaService: PrismaService,
  ) {}

  @HealthCheck()
  @Get()
  async health() {
    return await this.healthCheckService.check([
      async () => {
        await this.prismaService.$queryRaw`SELECT 1`;
        return { database: { status: "up" } };
      },
    ]);
  }
}

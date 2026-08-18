import { PrismaService } from "@database/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { AvailabityIntervalDto } from "../dto/availability-interval.dto";

@Injectable()
export class ProviderAvailabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProviderId(providerId: string) {
    return await this.prisma.availability.findMany({
      where: {
        providerId,
      },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    });
  }

  async replaceAvailibityTransaction(
    providerId: string,
    schedules: AvailabityIntervalDto[],
  ) {
    return await this.prisma.$transaction([
      this.prisma.availability.deleteMany({ where: { providerId } }),
      this.prisma.availability.createMany({
        data: schedules.map((s) => ({ providerId, ...s })),
      }),
    ]);
  }

  async findByProviderIdAndWeekday(providerId: string, weekday: number) {
    return await this.prisma.availability.findMany({
      where: {
        providerId,
        weekday,
        isAvailable: true,
      },
      orderBy: { startTime: "asc" },
    });
  }
}

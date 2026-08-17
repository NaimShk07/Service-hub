import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ProviderAvailabilityRepository } from "../repositories/provider-availability.repositor";
import { AvailabityIntervalDto } from "../dto/availability-interval.dto";
import { SetAvailabilityDto } from "../dto/set-availability.dto";

@Injectable()
export class ProviderAvailabilityService {
  private readonly logger = new Logger(ProviderAvailabilityService.name);

  constructor(
    private readonly providerAvailabilityRepository: ProviderAvailabilityRepository,
  ) {}

  async getAvailibity(providerId: string) {
    return await this.providerAvailabilityRepository.findByProviderId(
      providerId,
    );
  }

  async setAvailibity(providerId: string, dto: SetAvailabilityDto) {
    this.logger.log(
      `Updating availability schedule for provider: ${providerId}`,
    );
    this.validateSchedules(dto.schedules);

    const result =
      await this.providerAvailabilityRepository.replaceAvailibityTransaction(
        providerId,
        dto.schedules,
      );
    this.logger.log(
      `Successfully updated availability schedule for provider: ${providerId}`,
    );
    return result;
  }

  private timeToMinutes(timeStr: string): number {
    const parts = timeStr.split(":");

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    return hours * 60 + minutes;
  }

  private validateSchedules(schedule: AvailabityIntervalDto[]) {
    const grouped = Object.groupBy(schedule, (item) => item.weekday);

    for (const [weekday, intervals] of Object.entries(grouped)) {
      if (!intervals) continue;

      intervals.sort(
        (a, b) =>
          this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime),
      );

      for (let i = 0; i < intervals.length; i++) {
        const current = intervals[i];

        const start = this.timeToMinutes(current.startTime);
        const end = this.timeToMinutes(current.endTime);

        if (start >= end) {
          throw new BadRequestException(
            `Start time ${current.startTime} must be strictly before end time ${current.endTime} for weekday ${weekday}`,
          );
        }

        const next = intervals[i + 1];

        if (next && end > this.timeToMinutes(next.startTime)) {
          throw new BadRequestException(
            `Overlapping time intervals on weekday ${weekday}: [${current.startTime}-${current.endTime}] conflicts with [${next.startTime}-${next.endTime}]`,
          );
        }
      }
    }
  }
}

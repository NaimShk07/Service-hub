import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ProviderAvailabilityRepository } from "../repositories/provider-availability.repositor";
import { AvailabityIntervalDto } from "../dto/availability-interval.dto";
import { SetAvailabilityDto } from "../dto/set-availability.dto";
import { ProviderServiceRepository } from "../repositories/provider-service.repository";

@Injectable()
export class ProviderAvailabilityService {
  private readonly logger = new Logger(ProviderAvailabilityService.name);

  constructor(
    private readonly providerAvailabilityRepository: ProviderAvailabilityRepository,
    private readonly providerServiceRepository: ProviderServiceRepository,
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

    const providerServices =
      await this.providerServiceRepository.findByProviderId(providerId);

    const providerActiveServices = providerServices.filter(
      (service) => service.isActive === true,
    );

    const minReqMinutes =
      providerActiveServices.length > 0
        ? Math.min(
            ...providerActiveServices.map(
              (s) => s.durationMinutes + (s.bufferMinutes || 0),
            ),
          )
        : undefined;

    this.validateSchedules(dto.schedules, minReqMinutes);

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

  private validateSchedules(
    schedule: AvailabityIntervalDto[],
    minRequiredMinutes?: number,
  ) {
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

        // 1. Invalid or Zero-Length Range Check
        if (start >= end) {
          throw new BadRequestException(
            `Invalid time range [${current.startTime} -> ${current.endTime}] on weekday ${weekday}. Start time must be strictly before end time.`,
          );
        }

        // 2. Service Duration Accommodation Check (window = end - start)
        const windowMinutes = end - start;
        if (minRequiredMinutes && windowMinutes < minRequiredMinutes) {
          throw new BadRequestException(
            `Availability window [${current.startTime} -> ${current.endTime}] (${windowMinutes} mins) on weekday ${weekday} is too short to accommodate the minimum required service duration + buffer (${minRequiredMinutes} mins)`,
          );
        }

        const next = intervals[i + 1];

        // 3. Duplicate Interval check
        if (
          next &&
          current.startTime === next.startTime &&
          current.endTime === next.endTime
        ) {
          throw new BadRequestException(
            `Duplicate availability interval [${current.startTime} -> ${current.endTime}] on weekday ${weekday}`,
          );
        }

        // 4. Overlapping Interval Check
        if (next && end > this.timeToMinutes(next.startTime)) {
          throw new BadRequestException(
            `Overlapping time intervals on weekday ${weekday}: [${current.startTime}-${current.endTime}] conflicts with [${next.startTime}-${next.endTime}]`,
          );
        }
      }
    }
  }
}

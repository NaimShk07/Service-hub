import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>("redis.host") || "localhost";
    const port = this.configService.get<number>("redis.port") || 6379;
    const password = this.configService.get<string>("redis.password");

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (process.env.NODE_ENV === "test") {
          return null; // Don't retry during test suite runs if Redis is offline
        }
        return Math.min(times * 200, 2000);
      },
    });

    this.client.on("connect", () => {
      this.logger.log("Redis connected");
    });

    this.client.on("error", (error) => {
      this.logger.warn(`Redis connection unavailable (${error.message})`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.logger.log("Redis connection closed");
    }
  }

  private isReady(): boolean {
    return this.client && this.client.status === "ready";
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isReady()) {
      return null;
    }
    try {
      const value = await this.client.get(key);

      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Failed to get Redis key "${key}"`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (!this.isReady()) {
      return;
    }
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      this.logger.error(`Failed to set Redis key "${key}"`, error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isReady()) {
      return;
    }
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete Redis key "${key}"`, error);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.isReady()) {
      return;
    }
    try {
      const keys = await this.client.keys(pattern);

      if (keys.length === 0) {
        return;
      }

      await this.client.del(...keys);
    } catch (error) {
      this.logger.error(
        `Failed to delete Redis keys matching "${pattern}"`,
        error,
      );
    }
  }
}

import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { QUEUE_BOOKING, QUEUE_NOTIFICATION } from "./queues/queue.constants";
import { NotificationProcessor } from "./processors/notification.processor";
import { BookingProcessor } from "./processors/booking.processor";
import { NotificationQueueService } from "./queues/notification.queue";
import { BookingQueueService } from "./queues/booking.queue";

@Module({
  imports: [
    // 1. Root Redis connection for BullMQ
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>("redis.host", "localhost"),
          port: configService.get<number>("redis.port", 6379),
          password: configService.get<string>("redis.password") || undefined,
        },
      }),
    }),

    // 2. Register the two domain queues
    BullModule.registerQueue(
      { name: QUEUE_NOTIFICATION },
      { name: QUEUE_BOOKING },
    ),
  ],
  providers: [
    NotificationProcessor,
    BookingProcessor,
    NotificationQueueService,
    BookingQueueService,
  ],
  exports: [NotificationQueueService, BookingQueueService, BullModule],
})
export class JobsModule {}

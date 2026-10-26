import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { AppLogger } from "@common/logging/app.logger";

async function bootstrap() {
  const logger = new Logger("WorkerProcess");

  // Create standalone application context without starting an HTTP listener
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new AppLogger(),
  });

  // Enable graceful shutdown lifecycle hooks (SIGTERM, SIGINT)
  app.enableShutdownHooks();

  logger.log("=================================================");
  logger.log("🚀 ServiceHub BullMQ Worker started successfully");
  logger.log("Listening for jobs: [notification, booking]");
  logger.log("=================================================");
}

bootstrap().catch((err) => {
  console.error("Worker process failed to start:", err);
  process.exit(1);
});

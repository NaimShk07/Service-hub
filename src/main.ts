import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import cookieParser from "cookie-parser";
import { LoggingInterceptor } from "@common/interceptors/logging.interceptor";
import helmet from "helmet";
import { PrismaClientExceptionFilter } from "@common/filters/prisma-client-exception.filter";

import { AppLogger } from "@common/logging/app.logger";
import { TimeoutInterceptor } from "@common/interceptors/timeout.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: new AppLogger(),
  });
  const configService = app.get(ConfigService);

  // Enable graceful shutdown lifecycle hooks (SIGTERM, SIGINT)
  app.enableShutdownHooks();

  // Helmet Security Headers
  app.use(helmet());

  // Cookie Parser
  app.use(cookieParser());

  // Global prefix with health endpoints accessible at both root and prefix
  app.setGlobalPrefix("api/v1", {
    exclude: ["health", "health/(.*)", "api/v1/health", "api/v1/health/(.*)"],
  });

  // Enable CORS with constrained origins and exposed correlation headers
  const cors = configService.get<{
    origins: string[];
    credentials: boolean;
  }>("cors");

  app.enableCors({
    origin: cors?.origins.length ? cors.origins : false,
    credentials: cors?.credentials ?? false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "x-razorpay-signature",
      "x-razorpay-event-id",
    ],
    exposedHeaders: ["X-Request-ID"],
  });

  // Global Validation Pipe with strict unexpected property rejection
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

  // Global Exception Filters & Response Interceptors
  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new PrismaClientExceptionFilter(),
  );
  app.useGlobalInterceptors(
    new TimeoutInterceptor(30000),
    new TransformInterceptor(),
    new LoggingInterceptor(),
  );

  // Swagger OpenAPI Documentation Setup (disabled in production unless explicitly toggled)
  const isProduction =
    configService.get<string>("app.nodeEnv") === "production" ||
    process.env.NODE_ENV === "production";
  const swaggerEnabled =
    configService.get<string>("SWAGGER_ENABLED") === "true" ||
    process.env.SWAGGER_ENABLED === "true";

  if (!isProduction || swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle("ServiceHub API")
      .setDescription("ServiceHub Backend REST API Documentation")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = configService.get<number>("app.port", 3000);
  await app.listen(port);
  console.log(`🚀 Application running on: http://localhost:${port}/api/v1`);
  if (!isProduction || swaggerEnabled) {
    console.log(
      `📚 Swagger documentation at: http://localhost:${port}/api/docs`,
    );
  }
}
void bootstrap();

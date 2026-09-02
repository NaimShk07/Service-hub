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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  // Helmet
  app.use(helmet());

  // Cookie
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix("api/v1");

  // Enable CORS
  const cors = configService.get<{
    origins: string[];
    credentials: boolean;
  }>("cors");

  app.enableCors({
    origin: cors?.origins.length ? cors.origins : false,
    credentials: cors?.credentials ?? false,
  });

  // Global Validation Pipe
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

  // Global Exception Filter & Response Interceptor
  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new PrismaClientExceptionFilter(),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger OpenAPI Documentation Setup
  const config = new DocumentBuilder()
    .setTitle("ServiceHub API")
    .setDescription("ServiceHub Backend REST API Documentation")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = configService.get<number>("app.port", 3000);
  await app.listen(port);
  console.log(`🚀 Application running on: http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger documentation at: http://localhost:${port}/api/docs`);
}
void bootstrap();

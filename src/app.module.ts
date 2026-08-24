import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./database/prisma/prisma.module";
import { configs } from "./config/configuration";
import { AuthModule } from "@modules/auth/auth.module";
import { HealthModule } from "@modules/health/health.module";
import { CatalogsModule } from "@modules/catalog/catalogs.module";
import { ProviderModule } from "@modules/provider/provider.module";
import { StorageModule } from "@common/storage/storage.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { AdminModule } from "@modules/admin/admin.module";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { CacheModule } from "@common/cache/cache.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configs,
      ignoreEnvFile: process.env.NODE_ENV === "production",
      cache: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads"),
      serveRoot: "/uploads",
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: 60000, // 60 seconds (1 minute window)
          limit: 100, // Default global limit: 100 requests per minute
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    CatalogsModule,
    ProviderModule,
    HealthModule,
    StorageModule,
    AdminModule,
    CacheModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configs,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads"),
      serveRoot: "/uploads",
    }),
    PrismaModule,
    AuthModule,
    CatalogsModule,
    ProviderModule,
    HealthModule,
    StorageModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

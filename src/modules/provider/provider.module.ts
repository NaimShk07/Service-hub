import { Module } from "@nestjs/common";
import { ProviderService } from "./services/provider.service";
import { ProviderController } from "./controllers/provider.controller";
import { ProviderRepository } from "./repositories/provider.repository";
import { DocumentRepository } from "./repositories/document.repository";
import { StorageModule } from "@common/storage/storage.module";
import { ProviderServiceController } from "./controllers/provider-service.controller";
import { ProviderServiceRepository } from "./repositories/provider-service.repository";
import { ProviderServiceService } from "./services/provider-service.service";
import { CatalogsModule } from "@modules/catalog/catalogs.module";

@Module({
  imports: [StorageModule, CatalogsModule],
  controllers: [ProviderController, ProviderServiceController],
  providers: [
    ProviderService,
    ProviderRepository,
    ProviderServiceService,
    ProviderServiceRepository,
    DocumentRepository,
  ],
  exports: [ProviderRepository, ProviderService],
})
export class ProviderModule {}

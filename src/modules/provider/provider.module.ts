import { Module } from "@nestjs/common";
import { ProviderService } from "./services/provider.service";
import { ProviderController } from "./controllers/provider.controller";
import { ProviderRepository } from "./repositories/provider.repository";
import { DocumentRepository } from "./repositories/document.repository";
import { StorageModule } from "@common/storage/storage.module";

@Module({
  imports: [StorageModule],
  controllers: [ProviderController],
  providers: [ProviderService, ProviderRepository, DocumentRepository],
  exports: [ProviderRepository, ProviderService],
})
export class ProviderModule {}

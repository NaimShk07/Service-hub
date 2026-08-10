import { Module } from "@nestjs/common";
import { ProviderService } from "./services/provider.service";
import { ProviderController } from "./controllers/provider.controller";
import { ProviderRepository } from "./repositories/provider.repository";

@Module({
  controllers: [ProviderController],
  providers: [ProviderService, ProviderRepository],
})
export class ProviderModule {}

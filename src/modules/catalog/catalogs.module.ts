import { Module } from "@nestjs/common";
import { CategoryController } from "./controllers/category.controller";
import { CategoryService } from "./services/category.service";
import { ServiceService } from "./services/service.service";
import { ServiceController } from "./controllers/service.controller";
import { CategoryRepository } from "./repositories/category.repository";

@Module({
  controllers: [CategoryController, ServiceController],
  providers: [CategoryService, ServiceService, CategoryRepository],
})
export class CatalogsModule {}

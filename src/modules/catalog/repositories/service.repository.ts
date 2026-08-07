import { PrismaService } from "@database/prisma/prisma.service";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ServiceRepository {
  constructor(private readonly prismaService: PrismaService) {}
  
  findAll() {}

  findByCategory() {}

  findById() {}

  create() {}

  update() {}

  delete() {}
}

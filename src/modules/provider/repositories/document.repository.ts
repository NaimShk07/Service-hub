import { PrismaService } from "@database/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { DocumentType } from "@prisma-client/enums";

@Injectable()
export class DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDocumentByType(providerId: string, documentType: DocumentType) {
    return await this.prisma.providerDocument.findFirst({
      where: { providerId, documentType },
    });
  }

  async createDocument(
    providerId: string,
    documentType: DocumentType,
    fileUrl: string,
  ) {
    return await this.prisma.providerDocument.create({
      data: { providerId, documentType, fileUrl },
    });
  }

  async findDocumentsByProviderId(providerId: string) {
    return await this.prisma.providerDocument.findMany({
      where: { providerId },
    });
  }
}

import { DocumentType } from "@prisma-client/enums";
import { IsEnum, IsNotEmpty } from "class-validator";

export class UploadDocumentDto {
  /** Type of document being uploaded */
  @IsEnum(DocumentType)
  @IsNotEmpty()
  documentType: DocumentType;
}

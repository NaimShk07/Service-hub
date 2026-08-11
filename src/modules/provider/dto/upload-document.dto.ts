import { ApiProperty } from "@nestjs/swagger";
import { DocumentType } from "@prisma-client/enums";
import { IsEnum, IsNotEmpty } from "class-validator";

export class UploadDocumentDto {
  @ApiProperty({
    description: "Type of document being uploaded",
    enum: DocumentType,
    example: "LICENSE",
  })
  @IsEnum(DocumentType)
  @IsNotEmpty()
  documentType: DocumentType;
}

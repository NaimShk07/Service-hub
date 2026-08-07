import { IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateCategoryDto {
  @IsUUID()
  @IsOptional()
  categoryId: string;

  @IsString()
  @IsOptional()
  search: string;

  @IsOptional()
  @IsNumber()
  page: string;
}

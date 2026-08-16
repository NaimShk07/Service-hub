import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ProviderService } from "../services/provider.service";
import { CreateProviderDto } from "../dto/create-provider.dto";
import { UpdateProviderDto } from "../dto/update-provider.dto";

import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadDocumentDto } from "../dto/upload-document.dto";
import { RoleGuard } from "@modules/auth/guards/roles.guard";
import { Roles } from "@common/decorators/roles.decorator";
import { DocumentType, Role } from "@prisma-client/enums";
import { ProviderServiceService } from "../services/provider-service.service";
import { QueryPublicProviderServicesDto } from "../dto/query-public-provider-service.dto";

@ApiTags("Providers")
@Controller("")
export class ProviderController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly providerServiceService: ProviderServiceService,
  ) {}

  @Post("me/provider")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create provider profile for current user" })
  @ApiResponse({
    status: 201,
    description: "Provider profile created successfully",
  })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 409,
    description:
      "User is already registered as a provider or business name exists",
  })
  async createProfile(
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateProviderDto,
  ) {
    return await this.providerService.createProfile(userId, dto);
  }

  @Get("me/provider")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get own provider profile" })
  @ApiResponse({
    status: 200,
    description: "Provider profile retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Provider profile not found" })
  async getOwnProfile(@CurrentUser("userId") userId: string) {
    return await this.providerService.getOwnProfile(userId);
  }

  @Patch("me/provider")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update own provider profile" })
  @ApiResponse({
    status: 200,
    description: "Provider profile updated successfully",
  })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Provider profile not found" })
  @ApiResponse({ status: 409, description: "Business name already exists" })
  async updateOwnProfile(
    @CurrentUser("userId") userId: string,
    @Body() dto: UpdateProviderDto,
  ) {
    return await this.providerService.updateOwnProfile(userId, dto);
  }

  @Get("provider/:id")
  @ApiOperation({ summary: "Get provider profile by ID" })
  @ApiResponse({
    status: 200,
    description: "Provider profile retrieved successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid UUID format" })
  @ApiResponse({ status: 404, description: "Provider profile not found" })
  async getProviderById(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.providerService.getProfileById(id);
  }

  @Post("me/provider/documents")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "Upload provider document" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description: "Provider document upload",
    schema: {
      type: "object",
      properties: {
        documentType: {
          type: "string",
          enum: Object.values(DocumentType),
          example: "LICENSE",
        },
        file: { type: "string", format: "binary" },
      },
      required: ["documentType", "file"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Provider document uploaded successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Validation error or invalid file type/size",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Provider profile not found" })
  async uploadDocument(
    @CurrentUser("userId") userId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|pdf)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return await this.providerService.uploadDocument(userId, dto, file);
  }
  @Get("admin/provider/:id/document")
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get provider documents for admin" })
  @ApiResponse({
    status: 200,
    description: "Provider documents retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden. Admin access required" })
  @ApiResponse({ status: 404, description: "Provider or document not found" })
  async getDocumentForAdmin(
    @Param("id", new ParseUUIDPipe()) providerId: string,
  ) {
    return await this.providerService.getProviderDocumentsForAdmin(providerId);
  }

  @Get("providers/:id")
  @ApiOperation({ summary: "Get public provider profile by ID" })
  @ApiParam({
    name: "id",
    description: "Provider profile UUID",
    type: String,
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Public provider profile retrieved successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid UUID format" })
  @ApiResponse({ status: 404, description: "Provider profile not found" })
  async getPublicProviderById(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.providerService.getPublicProfileById(id);
  }

  @Get("providers/:id/services")
  @ApiOperation({ summary: "Get active services offered by provider" })
  @ApiParam({
    name: "id",
    description: "Provider profile UUID",
    type: String,
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of active services offered by provider",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid UUID format or query parameters",
  })
  @ApiResponse({ status: 404, description: "Provider profile not found" })
  async getPublicProviderServices(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() queryDto: QueryPublicProviderServicesDto,
  ) {
    return await this.providerServiceService.getPublicProviderServices(
      id,
      queryDto,
    );
  }
}

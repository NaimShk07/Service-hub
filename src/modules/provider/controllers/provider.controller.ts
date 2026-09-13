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
  UseInterceptors,
} from "@nestjs/common";
import { ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { ProviderService } from "../services/provider.service";
import { CreateProviderDto } from "../dto/create-provider.dto";
import { UpdateProviderDto } from "../dto/update-provider.dto";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadDocumentDto } from "../dto/upload-document.dto";
import { DocumentType, Role } from "@prisma-client/enums";
import { ProviderServiceService } from "../services/provider-service.service";
import { QueryPublicProviderServicesDto } from "../dto/query-public-provider-service.dto";
import { ProviderAvailabilityService } from "../services/provider-availability.service";
import { QuerySlotDto } from "../dto/query-slot.dto";
import { QueryProviderSearchDto } from "../dto/query-provider-search.dto";
import { Auth } from "@common/decorators/auth.decorator";

@ApiTags("Providers")
@Controller("")
export class ProviderController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly providerServiceService: ProviderServiceService,
    private readonly providerAvailabilityService: ProviderAvailabilityService,
  ) {}

  /**
   * Create provider profile for current user
   */
  @Post("me/provider")
  @Auth()
  async createProfile(
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateProviderDto,
  ) {
    return await this.providerService.createProfile(userId, dto);
  }

  /**
   * Get own provider profile
   */
  @Get("me/provider")
  @Auth()
  async getOwnProfile(@CurrentUser("userId") userId: string) {
    return await this.providerService.getOwnProfile(userId);
  }

  /**
   * Update own provider profile
   */
  @Patch("me/provider")
  @Auth()
  async updateOwnProfile(
    @CurrentUser("userId") userId: string,
    @Body() dto: UpdateProviderDto,
  ) {
    return await this.providerService.updateOwnProfile(userId, dto);
  }

  /**
   * Get provider profile by ID
   */
  @Get("provider/:id")
  async getProviderById(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.providerService.getProfileById(id);
  }

  /**
   * Upload provider document
   */
  @Post("me/provider/documents")
  @Auth()
  @UseInterceptors(FileInterceptor("file"))
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

  /**
   * Get provider documents for admin
   */
  @Get("admin/provider/:id/document")
  @Auth(Role.ADMIN)
  async getDocumentForAdmin(
    @Param("id", new ParseUUIDPipe()) providerId: string,
  ) {
    return await this.providerService.getProviderDocumentsForAdmin(providerId);
  }

  /**
   * Get paginated summary list of verified providers
   */
  @Get("providers")
  async searchProvider(@Query() queryDto: QueryProviderSearchDto) {
    return this.providerService.searchPublicProviders(queryDto);
  }

  /**
   * Get public provider profile by ID
   */
  @Get("providers/:id")
  async getPublicProviderById(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.providerService.getPublicProfileById(id);
  }

  /**
   * Get active services offered by provider
   */
  @Get("providers/:id/services")
  async getPublicProviderServices(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() queryDto: QueryPublicProviderServicesDto,
  ) {
    return await this.providerServiceService.getPublicProviderServices(
      id,
      queryDto,
    );
  }

  /**
   * Get dynamically generated available booking slots for a provider service and date
   */
  @Get("providers/:providerId/slots")
  async getAvailableSlots(
    @Param("providerId", new ParseUUIDPipe()) providerId: string,
    @Query() queryDto: QuerySlotDto,
  ) {
    return await this.providerAvailabilityService.generateSlot(
      providerId,
      queryDto,
    );
  }
}

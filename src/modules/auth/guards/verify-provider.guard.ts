import { ProviderRepository } from "@modules/provider/repositories/provider.repository";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { VerificationStatus } from "@prisma-client/enums";

@Injectable()
export class VerifiedProviderGuard implements CanActivate {
  constructor(private readonly providerRepository: ProviderRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException("User is not authenticated");
    }

    const provider = await this.providerRepository.findByUserId(user.userId);

    if (!provider) {
      throw new ForbiddenException("User is not registered as a provider");
    }

    if (provider.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        "Provider account is pending approval or suspended. Current status: " +
          provider.verificationStatus,
      );
    }

    request.provider = provider;

    return true;
  }
}

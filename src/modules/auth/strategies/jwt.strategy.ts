import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthRepository } from "../repositories/auth.repository";
import { Role } from "@prisma-client/enums";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("jwt.secret"),
    });
  }

  async validate(payload: { sub: string; email: string; role: Role }) {
    const dbUser = await this.authRepository.findById(payload.sub);

    if (!dbUser || dbUser.status !== "ACTIVE") {
      throw new UnauthorizedException("User account is inactive or deleted");
    }

    return { userId: dbUser.id, email: dbUser.email, role: dbUser.role };
  }
}

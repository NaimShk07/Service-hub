import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { RegisterDto } from "./dto/register.dto";
import { AuthRepository } from "./repositories/auth.repository";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma-client/enums";
import { ConfigService } from "@nestjs/config";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async generateTokens(user: {
    id: string;
    email: string;
    role: Role;
  }) {
    const jwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const options = {
      secret: this.configService.get("jwt.refreshSecret"),
      expiresIn: this.configService.get("jwt.refreshExpiresIn"),
    };

    // Auto take secret and expire
    const accessToken = await this.jwtService.signAsync(jwtPayload);
    const refreshToken = await this.jwtService.signAsync(jwtPayload, options);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.authRepository.updateRefreshToken(user.id, hashedRefreshToken);
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const emailExists = await this.authRepository.findByEmail(dto.email);

    if (emailExists) {
      throw new BadRequestException("Email already exists");
    }

    const phoneExists = await this.authRepository.findByPhone(dto.phone);

    if (phoneExists) {
      throw new BadRequestException("Phone already exists");
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.authRepository.create({
      email: dto.email,
      passwordHash: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: Role.USER,
    });

    const { accessToken, refreshToken } = await this.generateTokens(user);

    return {
      user: { id: user.id, name: user.firstName, email: user.email },
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credential");
    }

    await this.authRepository.updateLastLogin(user.id);

    const { accessToken, refreshToken } = await this.generateTokens(user);

    return {
      user: { id: user.id, name: user.firstName, email: user.email },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const options = {
      secret: this.configService.get("jwt.refreshSecret"),
      expiresIn: this.configService.get("jwt.refreshExpiresIn"),
    };

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token missing");
    }

    let user;

    try {
      user = await this.jwtService.verifyAsync(refreshToken, options);
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    if (!user) {
      throw new UnauthorizedException("Invalid credential");
    }

    const dbUser = await this.authRepository.findById(user.sub);

    if (!dbUser || !dbUser?.refreshTokenHash) {
      throw new UnauthorizedException("User not found");
    }

    const isMatch = await bcrypt.compare(refreshToken, dbUser.refreshTokenHash);

    if (!isMatch) {
      throw new UnauthorizedException("Invalid refrsh token");
    }

    const tokens = await this.generateTokens(dbUser);

    return {
      user: { id: dbUser.id, name: dbUser.firstName, email: dbUser.email },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string) {
    if (!userId) {
      throw new UnauthorizedException("User id not found");
    }
    await this.authRepository.update(userId, { refreshTokenHash: null });
    return { message: "User logout successfully" };
  }
}

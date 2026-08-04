import { BadRequestException, Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { AuthRepository } from './repositories/auth.repository';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma-client/enums';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const emailExists = await this.authRepository.findByEmail(dto.email);

    if (emailExists) {
      throw new BadRequestException('Email already exists');
    }

    const phoneExists = await this.authRepository.findByPhone(dto.phone);

    if (phoneExists) {
      throw new BadRequestException('Phone already exists');
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

    const jwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const options = {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    };

    // Auto take secret and expire
    const accessToken = await this.jwtService.signAsync(jwtPayload);
    const refreshToken = await this.jwtService.signAsync(jwtPayload, options);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.authRepository.updateRefreshToken(user.id, hashedRefreshToken);

    return {
      user: { id: user.id, name: user.firstName, email: user.email },
      accessToken,
      refreshToken,
    };
  }
}

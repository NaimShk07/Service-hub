import { PrismaService } from '@database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Role } from '@prisma-client/enums';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone: string;
    role: Role;
  }) {
    return this.prisma.user.create({ data });
  }
}

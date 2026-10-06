import { BaseRepository } from "@database/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { Prisma, Role, UserStatus } from "@prisma-client/client";
import { PrismaService } from "@database/prisma/prisma.service";
import {
  AdminUserRoleFilter,
  QueryAdminUserDto,
} from "../dto/query-admin-user.dto";

@Injectable()
export class AdminUserRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAllPaginated(queryDto: QueryAdminUserDto) {
    const {
      role,
      status,
      search,
      page = 1,
      limit = 10,
      email,
      phone,
      createdAt,
    } = queryDto;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.UserWhereInput = {
      ...(status && { status }),
      ...(email && { email: { mode: "insensitive", contains: email } }),
      ...(phone && { phone: { contains: phone } }),
      ...(search && {
        OR: [
          { email: { mode: "insensitive", contains: search } },
          { firstName: { mode: "insensitive", contains: search } },
          { lastName: { mode: "insensitive", contains: search } },
          { phone: { mode: "insensitive", contains: search } },
        ],
      }),
    };

    if (role === AdminUserRoleFilter.PROVIDER) {
      whereClause.providerProfile = { isNot: null };
    } else if (role === AdminUserRoleFilter.USER) {
      whereClause.role = Role.USER;
    } else if (role === AdminUserRoleFilter.ADMIN) {
      whereClause.role = Role.ADMIN;
    }

    let orderBy: Prisma.UserOrderByWithRelationInput = { createdAt: "desc" };
    if (createdAt) {
      const lower = createdAt.toLowerCase();
      if (lower === "asc" || lower === "desc") {
        orderBy = { createdAt: lower as "asc" | "desc" };
      } else {
        const dateVal = new Date(createdAt);
        if (!isNaN(dateVal.getTime())) {
          whereClause.createdAt = { gte: dateVal };
        }
      }
    }

    const query = this.prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    const total = this.prisma.user.count({
      where: whereClause,
    });

    return this.paginate(query, total, page, limit);
  }

  async findById(id: string) {
    return await this.prisma.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            bookings: true,
            reviews: true,
          },
        },
      },
    });
  }

  async updateStatus(id: string, status: UserStatus) {
    const updateUser = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return updateUser;
  }

  async countActiveAdmin(): Promise<number> {
    return await this.prisma.user.count({
      where: {
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
  }
}

import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "@database/prisma/prisma.service";
import { PaymentStatus } from "@prisma-client/enums";

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const [userGroups, providerGroups, bookingGroups, revenueAgg] =
      await Promise.all([
        this.prisma.user.groupBy({
          by: ["status"],
          _count: { id: true },
        }),
        this.prisma.providerProfile.groupBy({
          by: ["verificationStatus"],
          _count: { id: true },
        }),
        this.prisma.booking.groupBy({
          by: ["bookingStatus"],
          _count: { id: true },
        }),
        this.prisma.payment.aggregate({
          where: { status: PaymentStatus.SUCCESS },
          _sum: { amount: true },
        }),
      ]);

    // Build the user map
    const users = {
      total: userGroups.reduce((acc, g) => acc + g._count.id, 0),
      byStatus: Object.fromEntries(
        userGroups.map((g) => [g.status, g._count.id]),
      ),
    };

    // Build the provider map
    const providers = {
      total: providerGroups.reduce((acc, g) => acc + g._count.id, 0),
      byStatus: Object.fromEntries(
        providerGroups.map((g) => [g.verificationStatus, g._count.id]),
      ),
    };

    // Build the booking map
    const bookings = {
      total: bookingGroups.reduce((acc, g) => acc + g._count.id, 0),
      byStatus: Object.fromEntries(
        bookingGroups.map((g) => [g.bookingStatus, g._count.id]),
      ),
    };

    return {
      users,
      providers,
      bookings,
      revenue: {
        totalVolume: Number(revenueAgg._sum.amount ?? 0),
      },
    };
  }
}

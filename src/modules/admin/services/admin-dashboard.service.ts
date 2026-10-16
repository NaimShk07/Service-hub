import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@database/prisma/prisma.service";
import {
  BookingStatus,
  PaymentStatus,
  VerificationStatus,
} from "@prisma-client/enums";

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    this.logger.log("Aggregating platform-wide admin dashboard metrics");

    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
    );
    const endOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
    );

    const [
      userGroups,
      totalUsers,
      totalProvidersWithProfile,
      providerGroups,
      bookingGroups,
      todayBookingsCount,
      paymentGroups,
      revenueAgg,
      reviewAgg,
    ] = await Promise.all([
      // 1. Users by status
      this.prisma.user.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      // Total users
      this.prisma.user.count(),
      // Providers count (users with a providerProfile)
      this.prisma.user.count({
        where: { providerProfile: { isNot: null } },
      }),

      // 2. Providers by verificationStatus
      this.prisma.providerProfile.groupBy({
        by: ["verificationStatus"],
        _count: { id: true },
      }),

      // 3. Bookings by bookingStatus
      this.prisma.booking.groupBy({
        by: ["bookingStatus"],
        _count: { id: true },
      }),
      // Bookings today
      this.prisma.booking.count({
        where: {
          bookingDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),

      // 4. Payments by status
      this.prisma.payment.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      // Revenue
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.SUCCESS },
        _sum: { amount: true },
      }),

      // 5. Reviews aggregate
      this.prisma.review.aggregate({
        _count: { id: true },
        _avg: { rating: true },
      }),
    ]);

    // Map helpers
    const providerStatusMap = Object.fromEntries(
      providerGroups.map((g) => [g.verificationStatus, g._count.id]),
    );
    const bookingStatusMap = Object.fromEntries(
      bookingGroups.map((g) => [g.bookingStatus, g._count.id]),
    );
    const paymentStatusMap = Object.fromEntries(
      paymentGroups.map((g) => [g.status, g._count.id]),
    );

    const totalBookings = bookingGroups.reduce((acc, g) => acc + g._count.id, 0);
    const totalProviders = providerGroups.reduce((acc, g) => acc + g._count.id, 0);

    const users = {
      total: totalUsers,
      customers: Math.max(0, totalUsers - totalProvidersWithProfile),
      providers: totalProvidersWithProfile,
      byStatus: Object.fromEntries(
        userGroups.map((g) => [g.status, g._count.id]),
      ),
    };

    const providers = {
      total: totalProviders,
      pendingVerification: providerStatusMap[VerificationStatus.PENDING] || 0,
      verified: providerStatusMap[VerificationStatus.VERIFIED] || 0,
      suspended: providerStatusMap[VerificationStatus.SUSPENDED] || 0,
      byStatus: providerStatusMap,
    };

    const bookings = {
      total: totalBookings,
      today: todayBookingsCount,
      confirmed: bookingStatusMap[BookingStatus.CONFIRMED] || 0,
      completed: bookingStatusMap[BookingStatus.COMPLETED] || 0,
      cancelled: bookingStatusMap[BookingStatus.CANCELLED] || 0,
      byStatus: bookingStatusMap,
    };

    const payments = {
      successful: paymentStatusMap[PaymentStatus.SUCCESS] || 0,
      refunded: paymentStatusMap[PaymentStatus.REFUNDED] || 0,
    };

    const rawAvg = reviewAgg._avg.rating ?? 0;
    const reviews = {
      total: reviewAgg._count.id,
      averageRating: Number(rawAvg.toFixed(2)),
    };

    return {
      users,
      providers,
      bookings,
      payments,
      reviews,
      revenue: {
        totalVolume: Number(revenueAgg._sum.amount ?? 0),
      },
    };
  }
}

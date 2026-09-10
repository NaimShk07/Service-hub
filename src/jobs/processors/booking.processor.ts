import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { BOOKING_JOBS, QUEUE_BOOKING } from "../queues/queue.constants";
import { ExpirePaymentJobPayload } from "../jobs/booking.jobs";
import { PrismaService } from "@database/prisma/prisma.service";
import {
  AuditAction,
  BookingStatus,
  PaymentStatus,
} from "@prisma-client/enums";

@Processor(QUEUE_BOOKING, {
  concurrency: 2, // Low concurrency for state transitions to avoid lock contention
})
export class BookingProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ExpirePaymentJobPayload>): Promise<any> {
    this.logger.log(
      `Processing booking job [${job.id}] "${job.name}" for booking ${job.data.bookingId}`,
    );

    if (job.name === BOOKING_JOBS.EXPIRE_PAYMENT) {
      return await this.handlePaymentExpiration(job);
    }

    this.logger.warn(`Unhandled booking job name: "${job.name}"`);

    // Day 3 will wire the atomic expiration & cancellation cleanup logic here
    return { processed: true, bookingId: job.data.bookingId };
  }

  private async handlePaymentExpiration(
    job: Job<ExpirePaymentJobPayload>,
  ): Promise<any> {
    const { bookingId } = job.data;

    // 1. Load fresh booking state from PostgreSQL
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true },
    });

    if (!booking) {
      this.logger.warn(
        `Booking [${bookingId}] not found for expiration job [${job.id}]. Skipping.`,
      );
      return { skipped: true, reason: "booking_not_found" };
    }

    // 2. IDEMPOTENCY GUARD:
    // If payment succeeded earlier (CONFIRMED) or was already CANCELLED -> do nothing!
    if (booking.bookingStatus !== BookingStatus.PENDING_PAYMENT) {
      this.logger.log(
        `Booking [${bookingId}] is in "${booking.bookingStatus}" status. Expiration skipped (Idempotent).`,
      );
      return {
        skipped: true,
        currentStatus: booking.bookingStatus,
        reason: "already_transitioned",
      };
    }

    // 3. Atomic Expiration & Slot Release
    await this.prisma.$transaction(async (tx) => {
      // A. Transition Booking to EXPIRED
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          bookingStatus: BookingStatus.EXPIRED,
        },
      });

      // B. Mark lingering unpaid payment orders as FAILED
      await tx.payment.updateMany({
        where: {
          bookingId,
          status: { in: [PaymentStatus.CREATED, PaymentStatus.PENDING] },
        },
        data: {
          status: PaymentStatus.FAILED,
        },
      });

      // C. Audit Log
      await tx.auditLog.create({
        data: {
          actorUserId: booking.customerId,
          entityType: "Booking",
          entityId: bookingId,
          action: AuditAction.BOOKING_CANCELLED,
          oldValue: { status: booking.bookingStatus },
          newValue: {
            status: BookingStatus.EXPIRED,
            reason: "Payment window expired",
            expiredAt: new Date().toISOString(),
          },
        },
      });
    });

    this.logger.log(
      `✅ Booking [${bookingId}] expired. Time slot automatically released.`,
    );

    return {
      expired: true,
      bookingId,
      expiredAt: new Date(),
    };
  }
}

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overdueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "bookings_needsReview_idx" ON "bookings"("needsReview");

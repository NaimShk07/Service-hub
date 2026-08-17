/*
  Warnings:

  - You are about to drop the column `breakEnd` on the `availability` table. All the data in the column will be lost.
  - You are about to drop the column `breakStart` on the `availability` table. All the data in the column will be lost.
  - Changed the type of `startTime` on the `availability` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `endTime` on the `availability` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'PROVIDER_VERIFIED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED');

-- DropIndex
DROP INDEX "availability_providerId_weekday_key";

-- DropIndex
DROP INDEX "availability_weekday_idx";

-- AlterTable
ALTER TABLE "availability" DROP COLUMN "breakEnd",
DROP COLUMN "breakStart",
DROP COLUMN "startTime",
ADD COLUMN     "startTime" VARCHAR(10) NOT NULL,
DROP COLUMN "endTime",
ADD COLUMN     "endTime" VARCHAR(10) NOT NULL;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "availability_providerId_weekday_idx" ON "availability"("providerId", "weekday");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

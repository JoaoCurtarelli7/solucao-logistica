-- AlterTable
ALTER TABLE "Load" ADD COLUMN "additionalCosts" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Load" ADD COLUMN "additionalCostsNote" TEXT;

-- AlterTable
ALTER TABLE "LoadBillingClosing" ADD COLUMN "totalAdditionalCosts" DOUBLE PRECISION NOT NULL DEFAULT 0;

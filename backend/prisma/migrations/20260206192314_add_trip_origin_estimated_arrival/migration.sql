-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "estimatedArrival" TIMESTAMPTZ(6),
ADD COLUMN     "origin" TEXT;

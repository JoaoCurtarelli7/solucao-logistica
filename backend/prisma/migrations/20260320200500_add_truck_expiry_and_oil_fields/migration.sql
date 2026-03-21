-- AlterTable
ALTER TABLE "Truck"
ADD COLUMN "insuranceExpiry" TIMESTAMPTZ(6),
ADD COLUMN "tachographCalibrationExpiry" TIMESTAMPTZ(6),
ADD COLUMN "oilChangeEngineDate" TIMESTAMPTZ(6),
ADD COLUMN "oilChangeGearboxDate" TIMESTAMPTZ(6),
ADD COLUMN "oilChangeDifferentialDate" TIMESTAMPTZ(6);

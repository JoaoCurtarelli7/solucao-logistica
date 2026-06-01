-- Add tenantId to tables missing it: Maintenance, Transaction, TripExpense, MaintenanceServicePreset, AuditLog
-- Safe to re-run: uses IF NOT EXISTS / DO blocks
-- Backfill via parent relation before setting NOT NULL

-- ============================================================
-- 1. Maintenance (backfill via Truck.tenantId)
-- ============================================================
ALTER TABLE "Maintenance" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;

UPDATE "Maintenance" m
SET "tenantId" = t."tenantId"
FROM "Truck" t
WHERE m."truckId" = t.id
  AND m."tenantId" IS NULL;

-- Fallback: registros órfãos recebem o primeiro tenant existente
UPDATE "Maintenance"
SET "tenantId" = (SELECT MIN("id") FROM "Tenant")
WHERE "tenantId" IS NULL;

ALTER TABLE "Maintenance" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_maintenance_tenantId" ON "Maintenance"("tenantId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Maintenance_tenantId_fkey') THEN
    ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 2. Transaction (backfill via Employee.tenantId)
-- ============================================================
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;

UPDATE "Transaction" tr
SET "tenantId" = e."tenantId"
FROM "Employee" e
WHERE tr."employeeId" = e.id
  AND tr."tenantId" IS NULL;

UPDATE "Transaction"
SET "tenantId" = (SELECT MIN("id") FROM "Tenant")
WHERE "tenantId" IS NULL;

ALTER TABLE "Transaction" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_transaction_tenantId" ON "Transaction"("tenantId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_tenantId_fkey') THEN
    ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 3. TripExpense (backfill via Trip.tenantId)
-- ============================================================
ALTER TABLE "TripExpense" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;

UPDATE "TripExpense" te
SET "tenantId" = t."tenantId"
FROM "Trip" t
WHERE te."tripId" = t.id
  AND te."tenantId" IS NULL;

UPDATE "TripExpense"
SET "tenantId" = (SELECT MIN("id") FROM "Tenant")
WHERE "tenantId" IS NULL;

ALTER TABLE "TripExpense" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_tripExpense_tenantId" ON "TripExpense"("tenantId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TripExpense_tenantId_fkey') THEN
    ALTER TABLE "TripExpense" ADD CONSTRAINT "TripExpense_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 4. MaintenanceServicePreset (nullable — presets podem ser globais ou por tenant)
-- ============================================================
ALTER TABLE "MaintenanceServicePreset" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;

-- Troca unique(name) → unique(name, tenantId)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'MaintenanceServicePreset_name_key') THEN
    DROP INDEX "MaintenanceServicePreset_name_key";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'MaintenanceServicePreset_name_tenantId_key') THEN
    CREATE UNIQUE INDEX "MaintenanceServicePreset_name_tenantId_key"
    ON "MaintenanceServicePreset"("name", "tenantId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_maintenancePreset_tenantId" ON "MaintenanceServicePreset"("tenantId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceServicePreset_tenantId_fkey') THEN
    ALTER TABLE "MaintenanceServicePreset" ADD CONSTRAINT "MaintenanceServicePreset_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 5. AuditLog (nullable — eventos de sistema podem não ter tenant)
-- ============================================================
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;

UPDATE "AuditLog" al
SET "tenantId" = u."tenantId"
FROM "User" u
WHERE al."userId" = u.id
  AND al."tenantId" IS NULL;

-- tenantId fica nullable — não seta NOT NULL

CREATE INDEX IF NOT EXISTS "idx_auditLog_tenantId" ON "AuditLog"("tenantId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_tenantId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

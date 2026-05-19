-- Fix production schema drift
-- Safe to re-run: all statements use IF NOT EXISTS / DO blocks

-- ============================================================
-- 1. Create Tenant table
-- ============================================================
CREATE TABLE IF NOT EXISTS "Tenant" (
  "id"           SERIAL       PRIMARY KEY,
  "name"         TEXT         NOT NULL,
  "cnpj"         TEXT,
  "status"       TEXT         NOT NULL DEFAULT 'active',
  "plan"         TEXT         NOT NULL DEFAULT 'trial',
  "planExpiresAt" TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Tenant_cnpj_key') THEN
    CREATE UNIQUE INDEX "Tenant_cnpj_key" ON "Tenant"("cnpj");
  END IF;
END $$;

-- Add plan/planExpiresAt if Tenant already existed without them
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "plan"          TEXT DEFAULT 'trial';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP(3);

-- ============================================================
-- 2. Insert default tenant (id=1) if none exists
-- ============================================================
INSERT INTO "Tenant" ("id", "name", "status")
SELECT 1, 'Cliente Principal', 'active'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" WHERE "id" = 1);

-- ============================================================
-- 3. Create Role / Permission / RolePermission tables
-- ============================================================
CREATE TABLE IF NOT EXISTS "Role" (
  "id"          SERIAL       PRIMARY KEY,
  "name"        TEXT         NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Role_name_key') THEN
    CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Permission" (
  "id"          SERIAL       PRIMARY KEY,
  "key"         TEXT         NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Permission_key_key') THEN
    CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "roleId"       INTEGER NOT NULL,
  "permissionId" INTEGER NOT NULL,
  PRIMARY KEY ("roleId", "permissionId")
);

-- ============================================================
-- 4. Create Subscription table
-- ============================================================
CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"               SERIAL       PRIMARY KEY,
  "tenantId"         INTEGER      NOT NULL,
  "plan"             TEXT         NOT NULL DEFAULT 'trial',
  "status"           TEXT         NOT NULL DEFAULT 'active',
  "startedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"        TIMESTAMP(3),
  "stripeSubId"      TEXT,
  "stripeCustomerId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Subscription_tenantId_key') THEN
    CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");
  END IF;
END $$;

-- ============================================================
-- 5. Create AuditLog table
-- ============================================================
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"        SERIAL       PRIMARY KEY,
  "userId"    INTEGER,
  "action"    TEXT         NOT NULL,
  "details"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. Add missing columns to User
-- ============================================================
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId"     INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roleId"       INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone"        TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address"      TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status"       TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- 7. Add tenantId to all domain tables
-- ============================================================
ALTER TABLE "Employee"           ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "Truck"              ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "Trip"               ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "Month"              ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "Company"            ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "FinancialEntry"     ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "FinancialPeriod"    ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "Load"               ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "Closing"            ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "LoadBillingClosing" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;

-- ============================================================
-- 8. Add other missing columns
-- ============================================================
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "pixAccount" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "cpf"        TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "phone"      TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "email"      TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "address"    TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "hireDate"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "LoadBillingClosing" ADD COLUMN IF NOT EXISTS "totalDeliveries" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LoadBillingClosing" ADD COLUMN IF NOT EXISTS "totalWeight"      DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LoadBillingClosing" ADD COLUMN IF NOT EXISTS "documentType"     TEXT;
ALTER TABLE "LoadBillingClosing" ADD COLUMN IF NOT EXISTS "documentNumber"   TEXT;

ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "additionalCosts"     DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "additionalCostsNote" TEXT;
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "observations"        TEXT;

ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "origin"          TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "estimatedArrival" TIMESTAMP(3);
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "notes"           TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "insuranceExpiry"             TIMESTAMP(3);
ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "tachographCalibrationExpiry" TIMESTAMP(3);
ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "oilChangeEngineDate"         TIMESTAMP(3);
ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "oilChangeGearboxDate"        TIMESTAMP(3);
ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "oilChangeDifferentialDate"   TIMESTAMP(3);
ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "image"                       TEXT;

ALTER TABLE "FinancialEntry"  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FinancialEntry"  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FinancialPeriod" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FinancialPeriod" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Closing" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Closing" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Maintenance" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Maintenance" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- 9. Backfill tenantId = 1 where NULL
-- ============================================================
UPDATE "User"               SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Employee"           SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Truck"              SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Trip"               SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Month"              SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Company"            SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "FinancialEntry"     SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "FinancialPeriod"    SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Load"               SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Closing"            SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "LoadBillingClosing" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

-- Mark first user as super admin if exists
UPDATE "User" SET "isSuperAdmin" = true WHERE "id" = (SELECT MIN("id") FROM "User");

-- ============================================================
-- 10. Set NOT NULL after backfill
-- ============================================================
ALTER TABLE "User"               ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Employee"           ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Truck"              ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Trip"               ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Month"              ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Company"            ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "FinancialEntry"     ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "FinancialPeriod"    ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Load"               ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Closing"            ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "LoadBillingClosing" ALTER COLUMN "tenantId" SET NOT NULL;

-- ============================================================
-- 11. Foreign keys (skip if already exists)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_tenantId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_roleId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Employee_tenantId_fkey') THEN
    ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Truck_tenantId_fkey') THEN
    ALTER TABLE "Truck" ADD CONSTRAINT "Truck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trip_tenantId_fkey') THEN
    ALTER TABLE "Trip" ADD CONSTRAINT "Trip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Month_tenantId_fkey') THEN
    ALTER TABLE "Month" ADD CONSTRAINT "Month_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Company_tenantId_fkey') THEN
    ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialEntry_tenantId_fkey') THEN
    ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialPeriod_tenantId_fkey') THEN
    ALTER TABLE "FinancialPeriod" ADD CONSTRAINT "FinancialPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Load_tenantId_fkey') THEN
    ALTER TABLE "Load" ADD CONSTRAINT "Load_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Closing_tenantId_fkey') THEN
    ALTER TABLE "Closing" ADD CONSTRAINT "Closing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoadBillingClosing_tenantId_fkey') THEN
    ALTER TABLE "LoadBillingClosing" ADD CONSTRAINT "LoadBillingClosing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_tenantId_fkey') THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RolePermission_roleId_fkey') THEN
    ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RolePermission_permissionId_fkey') THEN
    ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 12. Unique constraints (multi-tenant)
-- ============================================================
-- Month: unique per tenant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_month_year_month_tenant') THEN
    DROP INDEX IF EXISTS "uq_month_year_month";
    CREATE UNIQUE INDEX "uq_month_year_month_tenant" ON "Month"("year", "month", "tenantId");
  END IF;
END $$;

-- Company: cnpj unique per tenant (drop old global unique if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Company_cnpj_tenantId_key') THEN
    BEGIN
      ALTER TABLE "Company" DROP CONSTRAINT IF EXISTS "Company_cnpj_key";
    EXCEPTION WHEN others THEN NULL;
    END;
    CREATE UNIQUE INDEX "Company_cnpj_tenantId_key" ON "Company"("cnpj", "tenantId");
  END IF;
END $$;

-- Truck: plate unique per tenant (drop old global unique if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Truck_plate_tenantId_key') THEN
    BEGIN
      ALTER TABLE "Truck" DROP CONSTRAINT IF EXISTS "Truck_plate_key";
    EXCEPTION WHEN others THEN NULL;
    END;
    CREATE UNIQUE INDEX "Truck_plate_tenantId_key" ON "Truck"("plate", "tenantId");
  END IF;
END $$;

-- ============================================================
-- 13. Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS "idx_user_tenantId"               ON "User"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_employee_tenantId"           ON "Employee"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_truck_tenantId"              ON "Truck"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_trip_tenantId"               ON "Trip"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_month_tenantId"              ON "Month"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_company_tenantId"            ON "Company"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_finEntry_tenantId"           ON "FinancialEntry"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_finPeriod_tenantId"          ON "FinancialPeriod"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_load_tenantId"               ON "Load"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_closing_tenantId"            ON "Closing"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_loadBillingClosing_tenantId" ON "LoadBillingClosing"("tenantId");

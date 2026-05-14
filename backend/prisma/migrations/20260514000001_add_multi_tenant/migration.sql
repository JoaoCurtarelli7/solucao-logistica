-- Multi-tenant migration
-- Safe: nullable → backfill → NOT NULL

-- 1. Create Tenant table
CREATE TABLE "Tenant" (
  "id"        SERIAL       PRIMARY KEY,
  "name"      TEXT         NOT NULL,
  "cnpj"      TEXT,
  "status"    TEXT         NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Tenant_cnpj_key" ON "Tenant"("cnpj");

-- 2. Insert default tenant for existing client
INSERT INTO "Tenant" ("name", "status") VALUES ('Cliente Principal', 'active');

-- 3. Add nullable tenantId columns + isSuperAdmin
ALTER TABLE "User"               ADD COLUMN "tenantId"     INTEGER;
ALTER TABLE "User"               ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee"           ADD COLUMN "tenantId"     INTEGER;
ALTER TABLE "Truck"              ADD COLUMN "tenantId"     INTEGER;
ALTER TABLE "Trip"               ADD COLUMN "tenantId"     INTEGER;
ALTER TABLE "Month"              ADD COLUMN "tenantId"     INTEGER;
ALTER TABLE "Company"            ADD COLUMN "tenantId"     INTEGER;
ALTER TABLE "FinancialEntry"     ADD COLUMN "tenantId"     INTEGER;
ALTER TABLE "FinancialPeriod"    ADD COLUMN "tenantId"     INTEGER;
ALTER TABLE "Load"               ADD COLUMN "tenantId"     INTEGER;
ALTER TABLE "Closing"            ADD COLUMN "tenantId"     INTEGER;
ALTER TABLE "LoadBillingClosing" ADD COLUMN "tenantId"     INTEGER;

-- 4. Backfill all existing data to tenant 1
UPDATE "User"               SET "tenantId" = 1;
UPDATE "Employee"           SET "tenantId" = 1;
UPDATE "Truck"              SET "tenantId" = 1;
UPDATE "Trip"               SET "tenantId" = 1;
UPDATE "Month"              SET "tenantId" = 1;
UPDATE "Company"            SET "tenantId" = 1;
UPDATE "FinancialEntry"     SET "tenantId" = 1;
UPDATE "FinancialPeriod"    SET "tenantId" = 1;
UPDATE "Load"               SET "tenantId" = 1;
UPDATE "Closing"            SET "tenantId" = 1;
UPDATE "LoadBillingClosing" SET "tenantId" = 1;

-- Mark first user as super admin
UPDATE "User" SET "isSuperAdmin" = true WHERE "id" = 1;

-- 5. Make tenantId NOT NULL
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

-- 6. Add foreign keys
ALTER TABLE "User"               ADD CONSTRAINT "User_tenantId_fkey"               FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Employee"           ADD CONSTRAINT "Employee_tenantId_fkey"           FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Truck"              ADD CONSTRAINT "Truck_tenantId_fkey"              FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trip"               ADD CONSTRAINT "Trip_tenantId_fkey"               FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Month"              ADD CONSTRAINT "Month_tenantId_fkey"              FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Company"            ADD CONSTRAINT "Company_tenantId_fkey"            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry"     ADD CONSTRAINT "FinancialEntry_tenantId_fkey"     FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialPeriod"    ADD CONSTRAINT "FinancialPeriod_tenantId_fkey"    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Load"               ADD CONSTRAINT "Load_tenantId_fkey"               FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Closing"            ADD CONSTRAINT "Closing_tenantId_fkey"            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoadBillingClosing" ADD CONSTRAINT "LoadBillingClosing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Fix unique constraints for multi-tenant
-- Month: year+month unique per tenant
ALTER TABLE "Month" DROP CONSTRAINT IF EXISTS "uq_month_year_month";
DROP INDEX IF EXISTS "uq_month_year_month";
CREATE UNIQUE INDEX "uq_month_year_month_tenant" ON "Month"("year", "month", "tenantId");

-- Company: cnpj unique per tenant
ALTER TABLE "Company" DROP CONSTRAINT IF EXISTS "Company_cnpj_key";
CREATE UNIQUE INDEX "Company_cnpj_tenantId_key" ON "Company"("cnpj", "tenantId");

-- Truck: plate unique per tenant
ALTER TABLE "Truck" DROP CONSTRAINT IF EXISTS "Truck_plate_key";
CREATE UNIQUE INDEX "Truck_plate_tenantId_key" ON "Truck"("plate", "tenantId");

-- 8. Performance indexes
CREATE INDEX "idx_user_tenantId"               ON "User"("tenantId");
CREATE INDEX "idx_employee_tenantId"           ON "Employee"("tenantId");
CREATE INDEX "idx_truck_tenantId"              ON "Truck"("tenantId");
CREATE INDEX "idx_trip_tenantId"               ON "Trip"("tenantId");
CREATE INDEX "idx_month_tenantId"              ON "Month"("tenantId");
CREATE INDEX "idx_company_tenantId"            ON "Company"("tenantId");
CREATE INDEX "idx_finEntry_tenantId"           ON "FinancialEntry"("tenantId");
CREATE INDEX "idx_finPeriod_tenantId"          ON "FinancialPeriod"("tenantId");
CREATE INDEX "idx_load_tenantId"               ON "Load"("tenantId");
CREATE INDEX "idx_closing_tenantId"            ON "Closing"("tenantId");
CREATE INDEX "idx_loadBillingClosing_tenantId" ON "LoadBillingClosing"("tenantId");

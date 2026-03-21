-- CreateTable
CREATE TABLE "LoadBillingClosing" (
    "id" SERIAL NOT NULL,
    "monthId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMPTZ(6) NOT NULL,
    "endDate" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "totalLoads" INTEGER NOT NULL DEFAULT 0,
    "totalGrossValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFreight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoadBillingClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_loadBillingClosing_monthId" ON "LoadBillingClosing"("monthId");

-- CreateIndex
CREATE INDEX "idx_loadBillingClosing_companyId" ON "LoadBillingClosing"("companyId");

-- AddForeignKey
ALTER TABLE "LoadBillingClosing"
ADD CONSTRAINT "fk_loadBillingClosing_month"
FOREIGN KEY ("monthId") REFERENCES "Month"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadBillingClosing"
ADD CONSTRAINT "fk_loadBillingClosing_company"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

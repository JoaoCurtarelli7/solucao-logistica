-- CreateTable
CREATE TABLE "MaintenanceServicePreset" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceServicePreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceServicePreset_name_key" ON "MaintenanceServicePreset"("name");

-- Serviços padrão (frota)
INSERT INTO "MaintenanceServicePreset" ("name", "isDefault") VALUES
('Troca de óleo do motor', true),
('Troca de óleo da caixa', true),
('Troca de óleo do diferencial', true),
('Troca de filtros (ar, óleo, combustível)', true),
('Revisão geral / preventiva', true),
('Freios (pastilhas / lonas / discos)', true),
('Pneus (troca / alinhamento / balanceamento)', true),
('Suspensão e direção', true),
('Elétrica e bateria', true),
('Arrefecimento (radiador / bomba d''água)', true),
('Embreagem', true),
('Injeção eletrônica / diagnóstico', true)
ON CONFLICT ("name") DO NOTHING;

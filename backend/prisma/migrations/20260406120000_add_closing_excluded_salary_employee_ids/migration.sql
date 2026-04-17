-- Coluna usada para excluir salários de funcionários do cálculo do fechamento.
-- Produção pode ter sido criada antes deste campo existir no schema.
ALTER TABLE "Closing" ADD COLUMN IF NOT EXISTS "excludedSalaryEmployeeIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

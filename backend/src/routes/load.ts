import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middlewares/authMiddleware";

function parseMaybeBrDateToDate(d: unknown): Date {
  if (d instanceof Date) return d;
  const s = String(d ?? "").trim();
  if (!s) return new Date();
  if (s.includes("/")) {
    const [day, month, year] = s.split("/");
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(s);
}

function formatDateBR(d: Date): string {
  const date = d instanceof Date ? d : new Date(d);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function loadEntryDescription(loadingNumber: string, loadDate: Date): string {
  return `Carga: ${loadingNumber} - ${formatDateBR(loadDate)}`;
}

export async function loadRoutes(app: FastifyInstance) {
  const paramsSchema = z.object({ id: z.coerce.number() });
  const companyParamsSchema = z.object({ companyId: z.coerce.number() });

  const bodySchema = z.object({
    date: z.union([z.coerce.date(), z.string()]).transform(parseMaybeBrDateToDate),
    loadingNumber: z.string().min(1),
    deliveries: z.coerce.number(),
    cargoWeight: z.coerce.number(),
    totalValue: z.coerce.number(),
    freight4: z.coerce.number(),
    totalFreight: z.coerce.number(),
    observations: z.string().optional(),
    companyId: z.coerce.number(),
  });

  const updateBodySchema = z.object({
    date: z.union([z.coerce.date(), z.string()]).transform(parseMaybeBrDateToDate).optional(),
    loadingNumber: z.string().min(1).optional(),
    deliveries: z.coerce.number().optional(),
    cargoWeight: z.coerce.number().optional(),
    totalValue: z.coerce.number().optional(),
    freight4: z.coerce.number().optional(),
    totalFreight: z.coerce.number().optional(),
    observations: z.string().optional(),
    companyId: z.coerce.number().optional(),
  });

  // protege todas as rotas deste módulo
  app.addHook("preHandler", authMiddleware);

  // LISTAR
  app.get("/loads", async (_req: FastifyRequest, rep: FastifyReply) => {
    try {
      const loads = await prisma.load.findMany({
        include: { Company: { select: { id: true, name: true, cnpj: true } } },
        orderBy: { date: "desc" },
      });
      return rep.send(loads);
    } catch (error) {
      app.log.error(error);
      return rep.code(500).send({ message: "Erro interno ao buscar os carregamentos" });
    }
  });

  // LISTAR POR EMPRESA
  app.get("/loads/company/:companyId", async (req: FastifyRequest, rep: FastifyReply) => {
    const { companyId } = companyParamsSchema.parse(req.params);

    try {
      await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

      const loads = await prisma.load.findMany({
        where: { companyId },
        include: { Company: { select: { id: true, name: true, cnpj: true } } },
        orderBy: { date: "desc" },
      });

      return rep.send(loads);
    } catch (error: any) {
      if (error?.code === "P2025") {
        return rep.code(404).send({ message: "Empresa não encontrada" });
      }
      app.log.error(error);
      return rep.code(500).send({ message: "Erro interno ao buscar os carregamentos da empresa" });
    }
  });

  // POR ID
  app.get("/loads/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);

    try {
      const load = await prisma.load.findUnique({
        where: { id },
        include: { Company: { select: { id: true, name: true, cnpj: true } } },
      });

      if (!load) return rep.code(404).send({ message: "Carregamento não encontrado" });
      return rep.send(load);
    } catch (error) {
      app.log.error(error);
      return rep.code(500).send({ message: "Erro interno ao buscar o carregamento" });
    }
  });

  // CRIAR
  app.post("/loads", async (req: FastifyRequest, rep: FastifyReply) => {
    const {
      date,
      loadingNumber,
      deliveries,
      cargoWeight,
      totalValue,
      freight4,
      totalFreight,
      observations,
      companyId,
    } = bodySchema.parse(req.body);

    try {
      await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

      const existing = await prisma.load.findFirst({
        where: { loadingNumber, companyId },
        select: { id: true },
      });
      if (existing) {
        return rep.code(400).send({ message: "Já existe um carregamento com este número para esta empresa" });
      }

      const load = await prisma.load.create({
        data: {
          date,
          loadingNumber,
          deliveries,
          cargoWeight,
          totalValue,
          freight4,
          totalFreight,
          observations: observations?.trim() ? observations : null,
          Company: { connect: { id: companyId } },
        },
        include: { Company: { select: { id: true, name: true, cnpj: true } } },
      });

      // Adicionar entrada no fechamento do mês (se existir fechamento aberto para essa empresa)
      const amount = totalFreight ?? freight4 ?? 0;
      if (amount > 0) {
        const loadDate = date instanceof Date ? date : new Date(date);
        const startOfDay = new Date(loadDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(loadDate);
        endOfDay.setHours(23, 59, 59, 999);

        const closings = await prisma.closing.findMany({
          where: {
            companyId,
            status: "aberto",
            startDate: { lte: endOfDay },
            endDate: { gte: startOfDay },
          },
        });

        for (const closing of closings) {
          await prisma.financialEntry.create({
            data: {
              description: loadEntryDescription(loadingNumber, loadDate),
              amount,
              category: "Comissões",
              date: loadDate,
              type: "entrada",
              companyId,
              closingId: closing.id,
            },
          });
        }
      }

      return rep.code(201).send(load);
    } catch (error: any) {
      if (error?.code === "P2025") {
        return rep.code(404).send({ message: "Empresa não encontrada" });
      }
      app.log.error("Erro ao criar carregamento:", error);
      const msg = error?.message || "Erro interno ao criar o carregamento";
      return rep.code(500).send({
        message: "Erro interno ao criar o carregamento",
        error: msg,
      });
    }
  });

  // ATUALIZAR
  app.put("/loads/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);
    const updateData = updateBodySchema.parse(req.body);

    try {
      const existing = await prisma.load.findUnique({ where: { id } });
      if (!existing) return rep.code(404).send({ message: "Carregamento não encontrado" });

      if (updateData.companyId) {
        await prisma.company.findUniqueOrThrow({ where: { id: updateData.companyId } });
      }

      if (updateData.loadingNumber && (updateData.companyId ?? existing.companyId)) {
        const targetCompanyId = updateData.companyId ?? existing.companyId;
        const duplicate = await prisma.load.findFirst({
          where: {
            loadingNumber: updateData.loadingNumber,
            companyId: targetCompanyId,
            id: { not: id },
          },
          select: { id: true },
        });
        if (duplicate) {
          return rep.code(400).send({ message: "Já existe um carregamento com este número para esta empresa" });
        }
      }

      const data: any = {
        ...(updateData.date !== undefined ? { date: updateData.date } : {}),
        ...(updateData.loadingNumber !== undefined ? { loadingNumber: updateData.loadingNumber } : {}),
        ...(updateData.deliveries !== undefined ? { deliveries: updateData.deliveries } : {}),
        ...(updateData.cargoWeight !== undefined ? { cargoWeight: updateData.cargoWeight } : {}),
        ...(updateData.totalValue !== undefined ? { totalValue: updateData.totalValue } : {}),
        ...(updateData.freight4 !== undefined ? { freight4: updateData.freight4 } : {}),
        ...(updateData.totalFreight !== undefined ? { totalFreight: updateData.totalFreight } : {}),
        ...(updateData.observations !== undefined
          ? { observations: updateData.observations?.trim() ? updateData.observations : null }
          : {}),
      };

      if (updateData.companyId !== undefined) {
        data.Company = { connect: { id: updateData.companyId } };
      }

      const updated = await prisma.load.update({
        where: { id },
        data,
        include: { Company: { select: { id: true, name: true, cnpj: true } } },
      });

      // Sincronizar fechamento: remover entradas antigas desta carga e recriar com dados atualizados
      const oldDesc = loadEntryDescription(existing.loadingNumber, existing.date);
      await prisma.financialEntry.deleteMany({
        where: {
          companyId: existing.companyId,
          type: "entrada",
          category: "Comissões",
          description: oldDesc,
        },
      });

      const newAmount = (updated as any).totalFreight ?? (updated as any).freight4 ?? 0;
      if (newAmount > 0) {
        const loadDate = (updated as any).date instanceof Date ? (updated as any).date : new Date((updated as any).date);
        const startOfDay = new Date(loadDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(loadDate);
        endOfDay.setHours(23, 59, 59, 999);

        const closings = await prisma.closing.findMany({
          where: {
            companyId: (updated as any).companyId,
            status: "aberto",
            startDate: { lte: endOfDay },
            endDate: { gte: startOfDay },
          },
        });

        for (const closing of closings) {
          await prisma.financialEntry.create({
            data: {
              description: loadEntryDescription((updated as any).loadingNumber, loadDate),
              amount: newAmount,
              category: "Comissões",
              date: loadDate,
              type: "entrada",
              companyId: (updated as any).companyId,
              closingId: closing.id,
            },
          });
        }
      }

      return rep.send(updated);
    } catch (error: any) {
      if (error?.code === "P2025") {
        return rep.code(404).send({ message: "Empresa não encontrada" });
      }
      app.log.error(error);
      return rep.code(500).send({ message: "Erro interno ao atualizar o carregamento" });
    }
  });

  // DELETAR
  app.delete("/loads/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);

    try {
      const existing = await prisma.load.findUnique({ where: { id } });
      if (!existing) return rep.code(404).send({ message: "Carregamento não encontrado" });

      // Remover entradas do fechamento que referenciam esta carga
      const desc = loadEntryDescription(existing.loadingNumber, existing.date);
      await prisma.financialEntry.deleteMany({
        where: {
          companyId: existing.companyId,
          type: "entrada",
          category: "Comissões",
          description: desc,
        },
      });

      await prisma.load.delete({ where: { id } });
      return rep.code(204).send();
    } catch (error) {
      app.log.error(error);
      return rep.code(500).send({ message: "Erro interno ao deletar o carregamento" });
    }
  });

  // POR PERÍODO
  app.get("/loads/period", async (req: FastifyRequest, rep: FastifyReply) => {
    const querySchema = z.object({
      startDate: z.union([z.coerce.date(), z.string()]).transform(parseMaybeBrDateToDate),
      endDate: z.union([z.coerce.date(), z.string()]).transform(parseMaybeBrDateToDate),
      companyId: z.coerce.number().optional(),
    });

    try {
      const { startDate, endDate, companyId } = querySchema.parse(req.query);

      const where: any = {
        date: { gte: startDate, lte: endDate },
        ...(companyId ? { companyId } : {}),
      };

      const loads = await prisma.load.findMany({
        where,
        include: { Company: { select: { id: true, name: true, cnpj: true } } },
        orderBy: { date: "desc" },
      });

      return rep.send(loads);
    } catch (error) {
      app.log.error(error);
      return rep.code(500).send({ message: "Erro interno ao buscar carregamentos por período" });
    }
  });
}

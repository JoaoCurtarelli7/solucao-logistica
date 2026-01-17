import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/authMiddleware";

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
    closings: z.coerce.number(),
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
    closings: z.coerce.number().optional(),
    observations: z.string().optional(),
    companyId: z.coerce.number().optional(),
  });

  // protege todas as rotas deste módulo
  app.addHook("preHandler", authenticate);

  // LISTAR
  app.get("/loads", async (_req, rep) => {
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
  app.get("/loads/company/:companyId", async (req, rep) => {
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
  app.get("/loads/:id", async (req, rep) => {
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
  app.post("/loads", async (req, rep) => {
    const {
      date,
      loadingNumber,
      deliveries,
      cargoWeight,
      totalValue,
      freight4,
      totalFreight,
      closings,
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
          closings,
          observations: observations?.trim() ? observations : null,
          Company: { connect: { id: companyId } },
        },
        include: { Company: { select: { id: true, name: true, cnpj: true } } },
      });

      return rep.code(201).send(load);
    } catch (error: any) {
      if (error?.code === "P2025") {
        return rep.code(404).send({ message: "Empresa não encontrada" });
      }
      app.log.error("Erro ao criar carregamento:", error);
      return rep.code(500).send({ message: "Erro interno ao criar o carregamento" });
    }
  });

  // ATUALIZAR
  app.put("/loads/:id", async (req, rep) => {
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
        ...(updateData.closings !== undefined ? { closings: updateData.closings } : {}),
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
  app.delete("/loads/:id", async (req, rep) => {
    const { id } = paramsSchema.parse(req.params);

    try {
      const existing = await prisma.load.findUnique({ where: { id } });
      if (!existing) return rep.code(404).send({ message: "Carregamento não encontrado" });

      await prisma.load.delete({ where: { id } });
      return rep.code(204).send();
    } catch (error) {
      app.log.error(error);
      return rep.code(500).send({ message: "Erro interno ao deletar o carregamento" });
    }
  });

  // POR PERÍODO
  app.get("/loads/period", async (req, rep) => {
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

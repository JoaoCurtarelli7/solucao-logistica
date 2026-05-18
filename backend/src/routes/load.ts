import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "../types/fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middlewares/authMiddleware";
import { paginationSchema, paginationMeta } from "../lib/paginate";

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
    date: z
      .union([z.coerce.date(), z.string()])
      .transform(parseMaybeBrDateToDate),
    loadingNumber: z.string().min(1),
    deliveries: z.coerce.number(),
    cargoWeight: z.coerce.number(),
    totalValue: z.coerce.number(),
    freight4: z.coerce.number(),
    totalFreight: z.coerce.number(),
    additionalCosts: z.coerce.number().optional().default(0),
    additionalCostsNote: z.string().optional(),
    observations: z.string().optional(),
    companyId: z.coerce.number(),
  });

  const updateBodySchema = z.object({
    date: z
      .union([z.coerce.date(), z.string()])
      .transform(parseMaybeBrDateToDate)
      .optional(),
    loadingNumber: z.string().min(1).optional(),
    deliveries: z.coerce.number().optional(),
    cargoWeight: z.coerce.number().optional(),
    totalValue: z.coerce.number().optional(),
    freight4: z.coerce.number().optional(),
    totalFreight: z.coerce.number().optional(),
    additionalCosts: z.coerce.number().optional(),
    additionalCostsNote: z.string().optional(),
    observations: z.string().optional(),
    companyId: z.coerce.number().optional(),
  });

  // protege todas as rotas deste módulo
  app.addHook("preHandler", authMiddleware);

  // LISTAR — suporta ?page=&limit=&search=&companyId=
  app.get("/loads", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const query = paginationSchema.extend({
        companyId: z.coerce.number().optional(),
      }).parse(req.query);
      const hasPagination = !!(req.query as Record<string, unknown>).page;

      const where = {
        tenantId,
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.search
          ? {
              OR: [
                { loadingNumber: { contains: query.search, mode: "insensitive" as const } },
                { Company: { name: { contains: query.search, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      };

      const include = { Company: { select: { id: true, name: true, cnpj: true, commission: true } } };

      if (!hasPagination) {
        const loads = await prisma.load.findMany({ where, include, orderBy: { date: "desc" } });
        return rep.send(loads);
      }

      const [total, loads] = await prisma.$transaction([
        prisma.load.count({ where }),
        prisma.load.findMany({
          where, include, orderBy: { date: "desc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
      ]);
      return rep.send({ data: loads, ...paginationMeta(total, query.page, query.limit) });
    } catch (error) {
      app.log.error(error);
      return rep.code(500).send({ message: "Erro interno ao buscar os carregamentos" });
    }
  });

  // LISTAR POR EMPRESA
  app.get(
    "/loads/company/:companyId",
    async (req: FastifyRequest, rep: FastifyReply) => {
      const { companyId } = companyParamsSchema.parse(req.params);
      const tenantId = req.user!.tenantId;

      try {
        const company = await prisma.company.findFirst({ where: { id: companyId, tenantId } });
        if (!company) return rep.code(404).send({ message: "Empresa não encontrada" });

        const loads = await prisma.load.findMany({
          where: { companyId, tenantId },
          include: {
            Company: {
              select: { id: true, name: true, cnpj: true, commission: true },
            },
          },
          orderBy: { date: "desc" },
        });

        return rep.send(loads);
      } catch (error: any) {
        if (error?.code === "P2025") {
          return rep.code(404).send({ message: "Empresa não encontrada" });
        }
        app.log.error(error);
        return rep
          .code(500)
          .send({
            message: "Erro interno ao buscar os carregamentos da empresa",
          });
      }
    },
  );

  // POR ID
  app.get("/loads/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);
    const tenantId = req.user!.tenantId;

    try {
      const load = await prisma.load.findFirst({
        where: { id, tenantId },
        include: {
          Company: {
            select: { id: true, name: true, cnpj: true, commission: true },
          },
        },
      });

      if (!load)
        return rep.code(404).send({ message: "Carregamento não encontrado" });
      return rep.send(load);
    } catch (error) {
      app.log.error(error);
      return rep
        .code(500)
        .send({ message: "Erro interno ao buscar o carregamento" });
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
      additionalCosts,
      additionalCostsNote,
      observations,
      companyId,
    } = bodySchema.parse(req.body);

    const tenantId = req.user!.tenantId;
    try {
      const company = await prisma.company.findFirst({ where: { id: companyId, tenantId } });
      if (!company) return rep.code(404).send({ message: "Empresa não encontrada" });

      const existing = await prisma.load.findFirst({
        where: { loadingNumber, companyId, tenantId },
        select: { id: true },
      });
      if (existing) {
        return rep.code(400).send({ message: "Já existe um carregamento com este número para esta empresa" });
      }

      const load = await prisma.load.create({
        data: {
          date, loadingNumber, deliveries, cargoWeight, totalValue, freight4, totalFreight,
          additionalCosts: Math.max(0, additionalCosts ?? 0),
          additionalCostsNote: additionalCostsNote?.trim() ? additionalCostsNote.trim() : null,
          observations: observations?.trim() ? observations : null,
          tenantId,
          companyId,
        },
        include: {
          Company: {
            select: { id: true, name: true, cnpj: true, commission: true },
          },
        },
      });

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
    const tenantId = req.user!.tenantId;

    try {
      const existing = await prisma.load.findFirst({ where: { id, tenantId } });
      if (!existing)
        return rep.code(404).send({ message: "Carregamento não encontrado" });

      if (updateData.companyId) {
        const company = await prisma.company.findFirst({
          where: { id: updateData.companyId, tenantId },
        });
        if (!company) return rep.code(404).send({ message: "Empresa não encontrada" });
      }

      if (
        updateData.loadingNumber &&
        (updateData.companyId ?? existing.companyId)
      ) {
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
          return rep
            .code(400)
            .send({
              message:
                "Já existe um carregamento com este número para esta empresa",
            });
        }
      }

      const data: any = {
        ...(updateData.date !== undefined ? { date: updateData.date } : {}),
        ...(updateData.loadingNumber !== undefined
          ? { loadingNumber: updateData.loadingNumber }
          : {}),
        ...(updateData.deliveries !== undefined
          ? { deliveries: updateData.deliveries }
          : {}),
        ...(updateData.cargoWeight !== undefined
          ? { cargoWeight: updateData.cargoWeight }
          : {}),
        ...(updateData.totalValue !== undefined
          ? { totalValue: updateData.totalValue }
          : {}),
        ...(updateData.freight4 !== undefined
          ? { freight4: updateData.freight4 }
          : {}),
        ...(updateData.totalFreight !== undefined
          ? { totalFreight: updateData.totalFreight }
          : {}),
        ...(updateData.additionalCosts !== undefined
          ? { additionalCosts: Math.max(0, updateData.additionalCosts) }
          : {}),
        ...(updateData.additionalCostsNote !== undefined
          ? {
              additionalCostsNote: updateData.additionalCostsNote?.trim()
                ? updateData.additionalCostsNote
                : null,
            }
          : {}),
        ...(updateData.observations !== undefined
          ? {
              observations: updateData.observations?.trim()
                ? updateData.observations
                : null,
            }
          : {}),
      };

      if (updateData.companyId !== undefined) {
        data.Company = { connect: { id: updateData.companyId } };
      }

      const updated = await prisma.load.update({
        where: { id },
        data,
        include: {
          Company: {
            select: { id: true, name: true, cnpj: true, commission: true },
          },
        },
      });

      return rep.send(updated);
    } catch (error: any) {
      if (error?.code === "P2025") {
        return rep.code(404).send({ message: "Empresa não encontrada" });
      }
      app.log.error(error);
      return rep
        .code(500)
        .send({ message: "Erro interno ao atualizar o carregamento" });
    }
  });

  // DELETAR
  app.delete("/loads/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);
    const tenantId = req.user!.tenantId;

    try {
      const existing = await prisma.load.findFirst({ where: { id, tenantId } });
      if (!existing)
        return rep.code(404).send({ message: "Carregamento não encontrado" });

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
      return rep
        .code(500)
        .send({ message: "Erro interno ao deletar o carregamento" });
    }
  });

  // POR PERÍODO
  app.get("/loads/period", async (req: FastifyRequest, rep: FastifyReply) => {
    const querySchema = z.object({
      startDate: z
        .union([z.coerce.date(), z.string()])
        .transform(parseMaybeBrDateToDate),
      endDate: z
        .union([z.coerce.date(), z.string()])
        .transform(parseMaybeBrDateToDate),
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
        include: {
          Company: {
            select: { id: true, name: true, cnpj: true, commission: true },
          },
        },
        orderBy: { date: "desc" },
      });

      return rep.send(loads);
    } catch (error) {
      app.log.error(error);
      return rep
        .code(500)
        .send({ message: "Erro interno ao buscar carregamentos por período" });
    }
  });
}

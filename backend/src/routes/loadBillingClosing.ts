import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "../types/fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/permissionMiddleware";

function parseBrOrIsoDate(value: unknown): Date {
  const s = String(value ?? "").trim();
  if (!s) throw new Error("Data obrigatória");
  if (s.includes("/")) {
    const [day, month, year] = s.split("/");
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(s);
}

function dateRangeFromMonth(month: { year: number; month: number }) {
  const start = new Date(month.year, month.month - 1, 1, 0, 0, 0, 0);
  const end = new Date(month.year, month.month, 0, 23, 59, 59, 999);
  return { start, end };
}

async function summarizeLoads(
  companyId: number,
  startDate: Date,
  endDate: Date,
  tenantId: number,
) {
  const company = await prisma.company.findFirstOrThrow({
    where: { id: companyId, tenantId },
    select: { id: true, commission: true, name: true, cnpj: true },
  });

  const loads = await prisma.load.findMany({
    where: { companyId, tenantId, date: { gte: startDate, lte: endDate } },
    orderBy: { date: "asc" },
  });

  const totalLoads = loads.length;
  const totalGrossValue = loads.reduce(
    (sum, l) => sum + (l.totalValue || 0),
    0,
  );
  const totalFreight = loads.reduce(
    (sum, l) => sum + (l.totalFreight || l.freight4 || 0),
    0,
  );
  const commissionRate = company.commission || 0;
  const totalCommission = (totalGrossValue * commissionRate) / 100;
  const totalAdditionalCosts = loads.reduce(
    (sum, l) =>
      sum + ((l as { additionalCosts?: number }).additionalCosts || 0),
    0,
  );
  const billingTotal = totalCommission + totalAdditionalCosts;
  const totalDeliveries = loads.reduce(
    (sum, l) => sum + (l.deliveries || 0),
    0,
  );
  const totalWeight = loads.reduce(
    (sum, l) => sum + (l.cargoWeight || 0),
    0,
  );

  return {
    company,
    loads,
    summary: {
      totalLoads,
      totalGrossValue,
      totalFreight,
      commissionRate,
      totalCommission,
      totalAdditionalCosts,
      billingTotal,
      totalDeliveries,
      totalWeight,
    },
  };
}

export async function loadBillingClosingRoutes(app: FastifyInstance) {
  const normalizeClosingRow = (row: any) => ({
    ...row,
    startDate:
      row?.startDate instanceof Date ? row.startDate : new Date(row?.startDate),
    endDate:
      row?.endDate instanceof Date ? row.endDate : new Date(row?.endDate),
  });

  const tableHint =
    "Módulo de fechamento de cargas ainda não está migrado. Execute no backend: npx prisma migrate deploy && npx prisma generate";

  const resolveDbErrorMessage = (error: unknown, fallback: string) => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      return tableHint;
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (
      /relation .* does not exist|table .* does not exist|unknown table/i.test(
        msg,
      )
    ) {
      return tableHint;
    }
    return fallback;
  };

  const hasGeneratedModel = () => Boolean((prisma as any).loadBillingClosing);

  const withRelations = async (row: any) => {
    const [month, company] = await Promise.all([
      prisma.month.findUnique({
        where: { id: row.monthId },
        select: { id: true, name: true, month: true, year: true },
      }),
      prisma.company.findUnique({
        where: { id: row.companyId },
        select: { id: true, name: true, cnpj: true, commission: true },
      }),
    ]);
    return { ...row, Month: month, Company: company };
  };

  const listClosings = async (filters: {
    monthId?: number;
    companyId?: number;
    status?: string;
    tenantId: number;
    orderBy?: string;
  }) => {
    const sortField = filters.orderBy === "name" ? "name"
      : filters.orderBy === "company" ? "companyId"
      : "createdAt";

    if (hasGeneratedModel()) {
      return (prisma as any).loadBillingClosing.findMany({
        where: {
          tenantId: filters.tenantId,
          ...(filters.monthId ? { monthId: filters.monthId } : {}),
          ...(filters.companyId ? { companyId: filters.companyId } : {}),
          ...(filters.status ? { status: filters.status } : {}),
        },
        include: {
          Month: { select: { id: true, name: true, month: true, year: true } },
          Company: {
            select: { id: true, name: true, cnpj: true, commission: true },
          },
        },
        orderBy: { [sortField]: "asc" },
      });
    }
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "LoadBillingClosing"
       WHERE "tenantId" = $1
         AND ($2::int IS NULL OR "monthId" = $2)
         AND ($3::int IS NULL OR "companyId" = $3)
         AND ($4::text IS NULL OR "status" = $4)
       ORDER BY "createdAt" DESC`,
      filters.tenantId,
      filters.monthId ?? null,
      filters.companyId ?? null,
      filters.status ?? null,
    );
    return Promise.all(rows.map((r) => withRelations(normalizeClosingRow(r))));
  };

  const createClosing = async (data: any) => {
    if (hasGeneratedModel()) {
      return (prisma as any).loadBillingClosing.create({ data });
    }
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "LoadBillingClosing"
       ("monthId","companyId","name","startDate","endDate","status","totalLoads","totalGrossValue","totalFreight","commissionRate","totalCommission","totalAdditionalCosts","billingTotal","totalDeliveries","totalWeight","documentType","documentNumber","tenantId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      data.monthId,
      data.companyId,
      data.name,
      data.startDate,
      data.endDate,
      data.status ?? "aberto",
      data.totalLoads ?? 0,
      data.totalGrossValue ?? 0,
      data.totalFreight ?? 0,
      data.commissionRate ?? 0,
      data.totalCommission ?? 0,
      data.totalAdditionalCosts ?? 0,
      data.billingTotal ?? 0,
      data.totalDeliveries ?? 0,
      data.totalWeight ?? 0,
      data.documentType ?? null,
      data.documentNumber ?? null,
      data.tenantId,
    );
    return normalizeClosingRow(rows[0]);
  };

  const findClosingOrThrow = async (id: number, tenantId: number) => {
    if (hasGeneratedModel()) {
      const row = await (prisma as any).loadBillingClosing.findFirst({
        where: { id, tenantId },
      });
      if (!row) throw new Error("NOT_FOUND");
      return normalizeClosingRow(row);
    }
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "LoadBillingClosing" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
      id,
      tenantId,
    );
    if (!rows[0]) throw new Error("NOT_FOUND");
    return normalizeClosingRow(rows[0]);
  };

  const updateClosing = async (id: number, data: any) => {
    if (hasGeneratedModel())
      return (prisma as any).loadBillingClosing.update({ where: { id }, data });
    const statusVal = data.status ?? null;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "LoadBillingClosing"
       SET "totalLoads"=$2,"totalGrossValue"=$3,"totalFreight"=$4,"commissionRate"=$5,"totalCommission"=$6,"totalAdditionalCosts"=$7,"billingTotal"=$8,"status"=COALESCE($9::text,"status"),"totalDeliveries"=$10,"totalWeight"=$11,"updatedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$1
       RETURNING *`,
      id,
      data.totalLoads ?? 0,
      data.totalGrossValue ?? 0,
      data.totalFreight ?? 0,
      data.commissionRate ?? 0,
      data.totalCommission ?? 0,
      data.totalAdditionalCosts ?? 0,
      data.billingTotal ?? 0,
      statusVal,
      data.totalDeliveries ?? 0,
      data.totalWeight ?? 0,
    );
    if (!rows[0]) throw new Error("NOT_FOUND");
    return normalizeClosingRow(rows[0]);
  };

  const updateDocumentFields = async (id: number, tenantId: number, data: { documentType?: string; documentNumber?: string }) => {
    if (hasGeneratedModel())
      return (prisma as any).loadBillingClosing.update({
        where: { id },
        data: { documentType: data.documentType ?? null, documentNumber: data.documentNumber ?? null, updatedAt: new Date() },
      });
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "LoadBillingClosing"
       SET "documentType"=$3,"documentNumber"=$4,"updatedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$1 AND "tenantId"=$2
       RETURNING *`,
      id,
      tenantId,
      data.documentType ?? null,
      data.documentNumber ?? null,
    );
    if (!rows[0]) throw new Error("NOT_FOUND");
    return normalizeClosingRow(rows[0]);
  };

  app.addHook("preHandler", authMiddleware);

  const createSchema = z.object({
    monthId: z.coerce.number(),
    companyId: z.coerce.number(),
    name: z.string().min(2),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    documentType: z.string().optional(),
    documentNumber: z.string().optional(),
  });

  app.get(
    "/load-billing-closings",
    { preHandler: requirePermission("closings.view") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const { monthId, companyId, status, orderBy } = z
          .object({
            monthId: z.coerce.number().optional(),
            companyId: z.coerce.number().optional(),
            status: z.string().optional(),
            orderBy: z.string().optional(),
          })
          .parse(req.query);

        const tenantId = req.user!.tenantId;
        const rows = await listClosings({ monthId, companyId, status, tenantId, orderBy });
        return rep.send(rows);
      } catch (error) {
        app.log.error(error);
        return rep
          .code(500)
          .send({
            message: resolveDbErrorMessage(
              error,
              "Erro ao listar fechamentos de carga",
            ),
          });
      }
    },
  );

  app.post(
    "/load-billing-closings",
    { preHandler: requirePermission("closings.create") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const data = createSchema.parse(req.body);
        const tenantId = req.user!.tenantId;
        const month = await prisma.month.findFirst({
          where: { id: data.monthId, tenantId },
          select: { id: true, month: true, year: true },
        });
        if (!month) return rep.code(404).send({ message: "Mês não encontrado" });

        const defaultRange = dateRangeFromMonth(month);

        let startDate: Date;
        let endDate: Date;

        if (data.startDate) {
          startDate = parseBrOrIsoDate(data.startDate);
          startDate.setHours(0, 0, 0, 0);
        } else {
          startDate = defaultRange.start;
        }

        if (data.endDate) {
          endDate = parseBrOrIsoDate(data.endDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          endDate = defaultRange.end;
        }

        const { summary } = await summarizeLoads(
          data.companyId,
          startDate,
          endDate,
          tenantId,
        );

        const createdBase = await createClosing({
          monthId: data.monthId,
          companyId: data.companyId,
          name: data.name,
          startDate,
          endDate,
          documentType: data.documentType ?? null,
          documentNumber: data.documentNumber ?? null,
          tenantId,
          ...summary,
        });
        const created = await withRelations(createdBase);

        return rep.code(201).send(created);
      } catch (error: any) {
        app.log.error(error);
        if (error?.code === "P2025") {
          return rep
            .code(404)
            .send({ message: "Mês ou empresa não encontrado" });
        }
        return rep
          .code(500)
          .send({
            message: resolveDbErrorMessage(
              error,
              "Erro ao criar fechamento de carga",
            ),
          });
      }
    },
  );

  app.patch(
    "/load-billing-closings/:id/document",
    { preHandler: requirePermission("closings.update") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
        const { documentType, documentNumber } = z.object({
          documentType: z.string().optional().nullable(),
          documentNumber: z.string().optional().nullable(),
        }).parse(req.body);
        const tenantId = req.user!.tenantId;
        const updated = await updateDocumentFields(id, tenantId, {
          documentType: documentType ?? undefined,
          documentNumber: documentNumber ?? undefined,
        });
        return rep.send(updated);
      } catch (error) {
        app.log.error(error);
        if (error instanceof Error && error.message === "NOT_FOUND")
          return rep.code(404).send({ message: "Fechamento não encontrado" });
        return rep.code(500).send({ message: "Erro ao atualizar documento" });
      }
    },
  );

  app.delete(
    "/load-billing-closings/:id",
    { preHandler: requirePermission("closings.delete") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
        const tenantId = req.user!.tenantId;
        const closing = await findClosingOrThrow(id, tenantId);

        if (closing.status === "fechado") {
          return rep.code(400).send({ message: "Não é possível excluir um fechamento já finalizado" });
        }

        if (hasGeneratedModel()) {
          await (prisma as any).loadBillingClosing.delete({ where: { id } });
        } else {
          await prisma.$queryRawUnsafe(
            `DELETE FROM "LoadBillingClosing" WHERE "id" = $1 AND "tenantId" = $2`,
            id,
            tenantId,
          );
        }
        return rep.code(204).send();
      } catch (error) {
        app.log.error(error);
        if (error instanceof Error && error.message === "NOT_FOUND")
          return rep.code(404).send({ message: "Fechamento não encontrado" });
        return rep.code(500).send({
          message: resolveDbErrorMessage(error, "Erro ao excluir fechamento de carga"),
        });
      }
    },
  );

  app.post(
    "/load-billing-closings/:id/finalize",
    { preHandler: requirePermission("closings.update") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
        const tenantId = req.user!.tenantId;
        const closing = await findClosingOrThrow(id, tenantId);

        if (closing.status === "fechado") {
          return rep
            .code(400)
            .send({ message: "Este fechamento de carga já foi finalizado" });
        }

        const endDate =
          closing.endDate instanceof Date
            ? closing.endDate
            : new Date(closing.endDate);

        const closings = await prisma.closing.findMany({
          where: {
            tenantId,
            monthId: closing.monthId,
            OR: [{ companyId: closing.companyId }, { companyId: null }],
          },
          orderBy: { createdAt: "desc" },
        });
        const targetClosing =
          closings.find((c) => c.companyId === closing.companyId) ??
          closings.find((c) => c.companyId === null);

        if (!targetClosing) {
          return rep.code(400).send({
            message:
              "Não existe fechamento de caixa para este mês/empresa. Crie um fechamento de caixa antes de finalizar.",
          });
        }

        const amount = Number(closing.billingTotal ?? 0);
        if (amount <= 0) {
          return rep
            .code(400)
            .send({
              message: "O valor a cobrar é zero. Não é possível finalizar.",
            });
        }

        await updateClosing(id, {
          status: "fechado",
          totalLoads: closing.totalLoads,
          totalGrossValue: closing.totalGrossValue,
          totalFreight: closing.totalFreight,
          commissionRate: closing.commissionRate,
          totalCommission: closing.totalCommission,
          totalAdditionalCosts: closing.totalAdditionalCosts ?? 0,
          billingTotal: closing.billingTotal,
          totalDeliveries: closing.totalDeliveries ?? 0,
          totalWeight: closing.totalWeight ?? 0,
        });

        await prisma.financialEntry.create({
          data: {
            description: `Fechamento de cargas: ${closing.name}`,
            amount,
            category: "Fechamento de cargas",
            date: endDate,
            type: "entrada",
            companyId: closing.companyId,
            closingId: targetClosing.id,
            tenantId,
          },
        });

        const updated = await withRelations(await findClosingOrThrow(id, tenantId));
        return rep.send(updated);
      } catch (error: any) {
        app.log.error(error);
        if (error?.message === "NOT_FOUND") {
          return rep
            .code(404)
            .send({ message: "Fechamento de carga não encontrado" });
        }
        return rep.code(500).send({
          message: resolveDbErrorMessage(
            error,
            "Erro ao finalizar fechamento de carga",
          ),
        });
      }
    },
  );

  app.post(
    "/load-billing-closings/:id/recalculate",
    { preHandler: requirePermission("closings.update") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
        const tenantId = req.user!.tenantId;
        const closing = await findClosingOrThrow(id, tenantId);
        const { summary } = await summarizeLoads(
          closing.companyId,
          closing.startDate,
          closing.endDate,
          tenantId,
        );
        const updatedBase = await updateClosing(id, summary);
        const updated = await withRelations(updatedBase);
        return rep.send(updated);
      } catch (error) {
        app.log.error(error);
        if (error instanceof Error && error.message === "NOT_FOUND") {
          return rep
            .code(404)
            .send({ message: "Fechamento de carga não encontrado" });
        }
        return rep
          .code(500)
          .send({
            message: resolveDbErrorMessage(
              error,
              "Erro ao recalcular fechamento de carga",
            ),
          });
      }
    },
  );

  app.get(
    "/load-billing-closings/:id/loads",
    { preHandler: requirePermission("closings.view") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
        const tenantId = req.user!.tenantId;
        const closing = await withRelations(await findClosingOrThrow(id, tenantId));

        const { loads, summary } = await summarizeLoads(
          closing.companyId,
          closing.startDate,
          closing.endDate,
          tenantId,
        );
        return rep.send({
          closing: {
            ...closing,
            ...summary,
          },
          loads,
        });
      } catch (error) {
        app.log.error(error);
        return rep
          .code(500)
          .send({
            message: resolveDbErrorMessage(
              error,
              "Erro ao buscar dados do fechamento de carga",
            ),
          });
      }
    },
  );
}

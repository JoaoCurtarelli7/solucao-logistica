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
) {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { id: true, commission: true, name: true, cnpj: true },
  });

  const loads = await prisma.load.findMany({
    where: { companyId, date: { gte: startDate, lte: endDate } },
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
  // Comissão percentual sobre o valor bruto das cargas.
  const totalCommission = (totalGrossValue * commissionRate) / 100;
  const totalAdditionalCosts = loads.reduce(
    (sum, l) =>
      sum + ((l as { additionalCosts?: number }).additionalCosts || 0),
    0,
  );
  // Valor total a cobrar: comissão + custos adicionais repassados (descarga, etc.).
  const billingTotal = totalCommission + totalAdditionalCosts;

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
  }) => {
    if (hasGeneratedModel()) {
      return (prisma as any).loadBillingClosing.findMany({
        where: {
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
        orderBy: { createdAt: "desc" },
      });
    }
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "LoadBillingClosing"
       WHERE ($1::int IS NULL OR "monthId" = $1)
         AND ($2::int IS NULL OR "companyId" = $2)
         AND ($3::text IS NULL OR "status" = $3)
       ORDER BY "createdAt" DESC`,
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
       ("monthId","companyId","name","startDate","endDate","status","totalLoads","totalGrossValue","totalFreight","commissionRate","totalCommission","totalAdditionalCosts","billingTotal")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
    );
    return normalizeClosingRow(rows[0]);
  };

  const findClosingOrThrow = async (id: number) => {
    if (hasGeneratedModel()) {
      const row = await (prisma as any).loadBillingClosing.findUniqueOrThrow({
        where: { id },
      });
      return normalizeClosingRow(row);
    }
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "LoadBillingClosing" WHERE "id" = $1 LIMIT 1`,
      id,
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
       SET "totalLoads"=$2,"totalGrossValue"=$3,"totalFreight"=$4,"commissionRate"=$5,"totalCommission"=$6,"totalAdditionalCosts"=$7,"billingTotal"=$8,"status"=COALESCE($9::text,"status"),"updatedAt"=CURRENT_TIMESTAMP
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
  });

  app.get(
    "/load-billing-closings",
    { preHandler: requirePermission("closings.view") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const { monthId, companyId, status } = z
          .object({
            monthId: z.coerce.number().optional(),
            companyId: z.coerce.number().optional(),
            status: z.string().optional(),
          })
          .parse(req.query);

        const rows = await listClosings({ monthId, companyId, status });
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
        const month = await prisma.month.findUniqueOrThrow({
          where: { id: data.monthId },
          select: { id: true, month: true, year: true },
        });

        const defaultRange = dateRangeFromMonth(month);
        const startDate = data.startDate
          ? parseBrOrIsoDate(data.startDate)
          : defaultRange.start;
        const endDate = data.endDate
          ? parseBrOrIsoDate(data.endDate)
          : defaultRange.end;

        const { summary } = await summarizeLoads(
          data.companyId,
          startDate,
          endDate,
        );

        const createdBase = await createClosing({
          monthId: data.monthId,
          companyId: data.companyId,
          name: data.name,
          startDate,
          endDate,
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

  app.post(
    "/load-billing-closings/:id/finalize",
    { preHandler: requirePermission("closings.update") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
        const closing = await findClosingOrThrow(id);

        if (closing.status === "fechado") {
          return rep
            .code(400)
            .send({ message: "Este fechamento de carga já foi finalizado" });
        }

        const endDate =
          closing.endDate instanceof Date
            ? closing.endDate
            : new Date(closing.endDate);

        // Buscar fechamento de caixa (Closing) para o mesmo mês e empresa
        const closings = await prisma.closing.findMany({
          where: {
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

        // Atualizar status para fechado
        await updateClosing(id, {
          status: "fechado",
          totalLoads: closing.totalLoads,
          totalGrossValue: closing.totalGrossValue,
          totalFreight: closing.totalFreight,
          commissionRate: closing.commissionRate,
          totalCommission: closing.totalCommission,
          totalAdditionalCosts: closing.totalAdditionalCosts ?? 0,
          billingTotal: closing.billingTotal,
        });

        // Criar entrada no fechamento de caixa
        await prisma.financialEntry.create({
          data: {
            description: `Fechamento de cargas: ${closing.name}`,
            amount,
            category: "Fechamento de cargas",
            date: endDate,
            type: "entrada",
            companyId: closing.companyId,
            closingId: targetClosing.id,
          },
        });

        const updated = await withRelations(await findClosingOrThrow(id));
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
        const closing = await findClosingOrThrow(id);
        const { summary } = await summarizeLoads(
          closing.companyId,
          closing.startDate,
          closing.endDate,
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
        const closing = await withRelations(await findClosingOrThrow(id));

        const { loads, summary } = await summarizeLoads(
          closing.companyId,
          closing.startDate,
          closing.endDate,
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

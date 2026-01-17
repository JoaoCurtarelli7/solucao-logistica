import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/authMiddleware";

// Converte "DD/MM/YYYY" -> Date, ou ISO -> Date, ou retorna null se vazio
function parsePtBrOrIsoToDate(input?: string | Date | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;

  const str = String(input).trim();
  if (!str) return null;

  // DD/MM/YYYY
  if (str.includes("/")) {
    const [dd, mm, yyyy] = str.split("/");
    const d = Number(dd), m = Number(mm), y = Number(yyyy);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      return new Date(y, m - 1, d);
    }
  }

  // tenta ISO/Date parseável
  const maybe = new Date(str);
  if (!isNaN(maybe.getTime())) return maybe;

  return null;
}

export async function tripExpenseRoutes(app: FastifyInstance) {
  const idParam = z.object({ id: z.coerce.number() });
  const tripIdParam = z.object({ tripId: z.coerce.number() });

  // schema do corpo para criar/atualizar despesa
  const expenseBodySchema = z.object({
    description: z.string().min(1, "Descrição é obrigatória"),
    amount: z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
    date: z.union([z.string(), z.date()]).transform((v) => {
      const parsed = parsePtBrOrIsoToDate(v as any);
      if (!parsed) {
        throw new Error("Data inválida. Use DD/MM/YYYY ou ISO.");
      }
      return parsed;
    }),
    category: z.string().min(1, "Categoria é obrigatória"),
    notes: z.string().optional(),
    tripId: z.coerce.number(),
  });

  app.addHook("preHandler", authenticate);

  // Listar todas as despesas (com filtros opcionais)
  app.get("/expenses", async (req, rep) => {
    try {
      const { tripId, category, startDate, endDate } = z
        .object({
          tripId: z.coerce.number().optional(),
          category: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .parse(req.query);

      const where: any = {};
      if (tripId) where.tripId = tripId;
      if (category) where.category = category;

      const start = parsePtBrOrIsoToDate(startDate || undefined);
      const end = parsePtBrOrIsoToDate(endDate || undefined);
      if (start && end) where.date = { gte: start, lte: end };

      const expenses = await prisma.tripExpense.findMany({
        where,
        include: {
          Trip: {
            select: {
              id: true,
              destination: true,
              driver: true,
              date: true,
              Truck: { select: { id: true, name: true, plate: true } },
            },
          },
        },
        orderBy: { date: "desc" },
      });

      return { expenses };
    } catch (error) {
      req.log.error(error);
      return rep.code(500).send({ message: "Erro ao listar despesas" });
    }
  });

  // Listar despesas de uma viagem específica
  app.get("/trips/:tripId/expenses", async (req, rep) => {
    try {
      const { tripId } = tripIdParam.parse(req.params);

      await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });

      const expenses = await prisma.tripExpense.findMany({
        where: { tripId },
        orderBy: { date: "desc" },
      });

      return { expenses };
    } catch (error: any) {
      if (error?.code === "P2025") {
        return rep.code(404).send({ message: "Viagem não encontrada" });
      }
      req.log.error(error);
      return rep.code(500).send({ message: "Erro ao listar despesas da viagem" });
    }
  });

  // Buscar despesa por ID
  app.get("/expenses/:id", async (req, rep) => {
    try {
      const { id } = idParam.parse(req.params);
      const expense = await prisma.tripExpense.findUniqueOrThrow({
        where: { id },
        include: {
          Trip: {
            select: {
              id: true,
              destination: true,
              driver: true,
              date: true,
              Truck: { select: { id: true, name: true, plate: true } },
            },
          },
        },
      });
      return expense;
    } catch (error: any) {
      if (error?.code === "P2025") {
        return rep.code(404).send({ message: "Despesa não encontrada" });
      }
      req.log.error(error);
      return rep.code(500).send({ message: "Erro ao buscar despesa" });
    }
  });

  // Criar despesa
  app.post("/expenses", async (req, rep) => {
    try {
      const data = expenseBodySchema.parse(req.body);

      await prisma.trip.findUniqueOrThrow({ where: { id: data.tripId } });

      const expense = await prisma.tripExpense.create({
        data: {
          description: data.description,
          amount: data.amount,
          date: data.date,
          category: data.category,
          notes: data.notes ?? null,
          Trip: { connect: { id: data.tripId } },
        },
        include: {
          Trip: {
            select: {
              id: true,
              destination: true,
              driver: true,
              date: true,
              Truck: { select: { id: true, name: true, plate: true } },
            },
          },
        },
      });

      return rep.code(201).send(expense);
    } catch (error: any) {
      req.log.error(error);
      if (error instanceof Error && /Data inválida/i.test(error.message)) {
        return rep.code(400).send({ message: error.message });
      }
      if (error?.code === "P2025") {
        return rep.code(400).send({ message: "Viagem não encontrada" });
      }
      return rep.code(500).send({ message: "Erro ao criar despesa" });
    }
  });

  // Atualizar despesa
  app.put("/expenses/:id", async (req, rep) => {
    try {
      const { id } = idParam.parse(req.params);
      const data = expenseBodySchema.parse(req.body);

      const existing = await prisma.tripExpense.findUnique({ where: { id } });
      if (!existing) return rep.code(404).send({ message: "Despesa não encontrada" });

      if (data.tripId !== existing.tripId) {
        await prisma.trip.findUniqueOrThrow({ where: { id: data.tripId } });
      }

      const expense = await prisma.tripExpense.update({
        where: { id },
        data: {
          description: data.description,
          amount: data.amount,
          date: data.date,
          category: data.category,
          notes: data.notes ?? null,
          Trip: { connect: { id: data.tripId } },
        },
        include: {
          Trip: {
            select: {
              id: true,
              destination: true,
              driver: true,
              date: true,
              Truck: { select: { id: true, name: true, plate: true } },
            },
          },
        },
      });

      return expense;
    } catch (error: any) {
      req.log.error(error);
      if (error?.code === "P2025") {
        return rep.code(400).send({ message: "Viagem não encontrada" });
      }
      return rep.code(500).send({ message: "Erro ao atualizar despesa" });
    }
  });

  // Deletar despesa
  app.delete("/expenses/:id", async (req, rep) => {
    try {
      const { id } = idParam.parse(req.params);

      const expense = await prisma.tripExpense.findUnique({ where: { id } });
      if (!expense) return rep.code(404).send({ message: "Despesa não encontrada" });

      await prisma.tripExpense.delete({ where: { id } });
      return rep.code(204).send();
    } catch (error) {
      req.log.error(error);
      return rep.code(500).send({ message: "Erro ao deletar despesa" });
    }
  });

  // Resumo de despesas
  app.get("/expenses/summary", async (req, rep) => {
    try {
      const { tripId, category, startDate, endDate } = z
        .object({
          tripId: z.coerce.number().optional(),
          category: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .parse(req.query);

      const where: any = {};
      if (tripId) where.tripId = tripId;
      if (category) where.category = category;

      const start = parsePtBrOrIsoToDate(startDate || undefined);
      const end = parsePtBrOrIsoToDate(endDate || undefined);
      if (start && end) where.date = { gte: start, lte: end };

      const expenses = await prisma.tripExpense.findMany({ where });

      const totalExpenses = expenses.length;
      const totalAmount = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const averageAmount = totalExpenses > 0 ? totalAmount / totalExpenses : 0;

      const expensesByCategory = expenses.reduce((acc: Record<string, number>, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0);
        return acc;
      }, {} as Record<string, number>);

      return {
        summary: {
          totalExpenses,
          totalAmount,
          averageAmount,
          expensesByCategory,
        },
        expenses: expenses.length,
      };
    } catch (error) {
      req.log.error(error);
      return rep.code(500).send({ message: "Erro ao gerar resumo de despesas" });
    }
  });
}

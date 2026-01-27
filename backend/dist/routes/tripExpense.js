"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripExpenseRoutes = tripExpenseRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middlewares/authMiddleware");
// Converte "DD/MM/YYYY" -> Date, ou ISO -> Date, ou retorna null se vazio
function parsePtBrOrIsoToDate(input) {
    if (!input)
        return null;
    if (input instanceof Date)
        return input;
    const str = String(input).trim();
    if (!str)
        return null;
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
    if (!isNaN(maybe.getTime()))
        return maybe;
    return null;
}
async function tripExpenseRoutes(app) {
    const idParam = zod_1.z.object({ id: zod_1.z.coerce.number() });
    const tripIdParam = zod_1.z.object({ tripId: zod_1.z.coerce.number() });
    // schema do corpo para criar/atualizar despesa
    const expenseBodySchema = zod_1.z.object({
        description: zod_1.z.string().min(1, "Descrição é obrigatória"),
        amount: zod_1.z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
        date: zod_1.z.union([zod_1.z.string(), zod_1.z.date()]).transform((v) => {
            const parsed = parsePtBrOrIsoToDate(v);
            if (!parsed) {
                throw new Error("Data inválida. Use DD/MM/YYYY ou ISO.");
            }
            return parsed;
        }),
        category: zod_1.z.string().min(1, "Categoria é obrigatória"),
        notes: zod_1.z.string().optional(),
        tripId: zod_1.z.coerce.number(),
    });
    app.addHook("preHandler", authMiddleware_1.authMiddleware);
    // Listar todas as despesas (com filtros opcionais)
    app.get("/expenses", async (req, rep) => {
        try {
            const { tripId, category, startDate, endDate } = zod_1.z
                .object({
                tripId: zod_1.z.coerce.number().optional(),
                category: zod_1.z.string().optional(),
                startDate: zod_1.z.string().optional(),
                endDate: zod_1.z.string().optional(),
            })
                .parse(req.query);
            const where = {};
            if (tripId)
                where.tripId = tripId;
            if (category)
                where.category = category;
            const start = parsePtBrOrIsoToDate(startDate || undefined);
            const end = parsePtBrOrIsoToDate(endDate || undefined);
            if (start && end)
                where.date = { gte: start, lte: end };
            const expenses = await prisma_1.prisma.tripExpense.findMany({
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
        }
        catch (error) {
            req.log.error(error);
            return rep.code(500).send({ message: "Erro ao listar despesas" });
        }
    });
    // Listar despesas de uma viagem específica
    app.get("/trips/:tripId/expenses", async (req, rep) => {
        try {
            const { tripId } = tripIdParam.parse(req.params);
            await prisma_1.prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
            const expenses = await prisma_1.prisma.tripExpense.findMany({
                where: { tripId },
                orderBy: { date: "desc" },
            });
            return { expenses };
        }
        catch (error) {
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
            const expense = await prisma_1.prisma.tripExpense.findUniqueOrThrow({
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
        }
        catch (error) {
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
            await prisma_1.prisma.trip.findUniqueOrThrow({ where: { id: data.tripId } });
            const expense = await prisma_1.prisma.tripExpense.create({
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
        }
        catch (error) {
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
            const existing = await prisma_1.prisma.tripExpense.findUnique({ where: { id } });
            if (!existing)
                return rep.code(404).send({ message: "Despesa não encontrada" });
            if (data.tripId !== existing.tripId) {
                await prisma_1.prisma.trip.findUniqueOrThrow({ where: { id: data.tripId } });
            }
            const expense = await prisma_1.prisma.tripExpense.update({
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
        }
        catch (error) {
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
            const expense = await prisma_1.prisma.tripExpense.findUnique({ where: { id } });
            if (!expense)
                return rep.code(404).send({ message: "Despesa não encontrada" });
            await prisma_1.prisma.tripExpense.delete({ where: { id } });
            return rep.code(204).send();
        }
        catch (error) {
            req.log.error(error);
            return rep.code(500).send({ message: "Erro ao deletar despesa" });
        }
    });
    // Resumo de despesas
    app.get("/expenses/summary", async (req, rep) => {
        try {
            const { tripId, category, startDate, endDate } = zod_1.z
                .object({
                tripId: zod_1.z.coerce.number().optional(),
                category: zod_1.z.string().optional(),
                startDate: zod_1.z.string().optional(),
                endDate: zod_1.z.string().optional(),
            })
                .parse(req.query);
            const where = {};
            if (tripId)
                where.tripId = tripId;
            if (category)
                where.category = category;
            const start = parsePtBrOrIsoToDate(startDate || undefined);
            const end = parsePtBrOrIsoToDate(endDate || undefined);
            if (start && end)
                where.date = { gte: start, lte: end };
            const expenses = await prisma_1.prisma.tripExpense.findMany({ where });
            const totalExpenses = expenses.length;
            const totalAmount = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
            const averageAmount = totalExpenses > 0 ? totalAmount / totalExpenses : 0;
            const expensesByCategory = expenses.reduce((acc, expense) => {
                acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0);
                return acc;
            }, {});
            return {
                summary: {
                    totalExpenses,
                    totalAmount,
                    averageAmount,
                    expensesByCategory,
                },
                expenses: expenses.length,
            };
        }
        catch (error) {
            req.log.error(error);
            return rep.code(500).send({ message: "Erro ao gerar resumo de despesas" });
        }
    });
}

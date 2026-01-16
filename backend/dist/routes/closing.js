"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closingRoutes = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middlewares/authMiddleware");
async function closingRoutes(app) {
    app.addHook("preHandler", authMiddleware_1.authenticate);
    // Schema para validação de fechamento
    const createClosingSchema = zod_1.z.object({
        monthId: zod_1.z.number(),
        companyId: zod_1.z.number().optional(),
        name: zod_1.z.string().min(1, "Nome do fechamento é obrigatório"),
        startDate: zod_1.z.string().nullable().optional().transform((str) => {
            if (!str)
                return null;
            // Converter DD/MM/YYYY para Date
            const [day, month, year] = str.split('/');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }),
        endDate: zod_1.z.string().nullable().optional().transform((str) => {
            if (!str)
                return null;
            // Converter DD/MM/YYYY para Date
            const [day, month, year] = str.split('/');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }),
    });
    const updateClosingSchema = zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        startDate: zod_1.z.string().nullable().transform((str) => {
            if (!str)
                return null;
            // Converter DD/MM/YYYY para Date
            const [day, month, year] = str.split('/');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }).optional(),
        endDate: zod_1.z.string().nullable().transform((str) => {
            if (!str)
                return null;
            // Converter DD/MM/YYYY para Date
            const [day, month, year] = str.split('/');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }).optional(),
        status: zod_1.z.enum(["aberto", "fechado", "cancelado"]).optional(),
    });
    // Listar fechamentos
    app.get("/closings", async (req, rep) => {
        try {
            const { monthId, companyId, status } = req.query;
            let whereClause = {};
            if (monthId) {
                whereClause.monthId = parseInt(monthId);
            }
            if (companyId) {
                whereClause.companyId = parseInt(companyId);
            }
            if (status) {
                whereClause.status = status;
            }
            const closings = await prisma_1.prisma.closing.findMany({
                where: whereClause,
                include: {
                    Month: {
                        select: {
                            id: true,
                            name: true,
                            year: true,
                            month: true,
                        },
                    },
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
            // Formatar resposta para manter compatibilidade com o frontend
            const formattedClosings = closings.map(c => ({
                ...c,
                monthName: c.Month?.name,
                monthYear: c.Month?.year,
                monthNumber: c.Month?.month,
                companyName: c.Company?.name,
                companyCnpj: c.Company?.cnpj,
            }));
            return rep.send(formattedClosings);
        }
        catch (error) {
            return rep.code(500).send({
                message: "Erro interno do servidor",
                error: error?.message || 'Erro desconhecido'
            });
        }
    });
    // Obter fechamento específico
    app.get("/closings/:id", async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const closing = await prisma_1.prisma.closing.findUnique({
                where: { id },
                include: {
                    Month: {
                        select: {
                            id: true,
                            name: true,
                            year: true,
                            month: true,
                        },
                    },
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                    FinancialEntry: {
                        orderBy: { date: 'desc' },
                    },
                },
            });
            if (!closing) {
                return rep.code(404).send({ message: "Fechamento não encontrado" });
            }
            return rep.send(closing);
        }
        catch (error) {
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Criar novo fechamento
    app.post("/closings", async (req, rep) => {
        try {
            const data = createClosingSchema.parse(req.body);
            // Verificar se o mês existe
            const month = await prisma_1.prisma.month.findUnique({
                where: { id: data.monthId },
            });
            if (!month) {
                return rep.code(404).send({ message: "Mês não encontrado" });
            }
            // Verificar se a empresa existe (se fornecida)
            if (data.companyId) {
                const company = await prisma_1.prisma.company.findUnique({
                    where: { id: data.companyId },
                });
                if (!company) {
                    return rep.code(404).send({ message: "Empresa não encontrada" });
                }
            }
            // Criar fechamento usando Prisma ORM em vez de SQL bruto
            const closingData = {
                monthId: data.monthId,
                companyId: data.companyId || null,
                name: data.name,
                status: 'aberto',
                startDate: data.startDate || null,
                endDate: data.endDate || null,
            };
            const newClosing = await prisma_1.prisma.closing.create({
                data: closingData,
                include: {
                    Month: {
                        select: {
                            id: true,
                            name: true,
                            year: true,
                            month: true,
                        },
                    },
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                },
            });
            return rep.code(201).send(newClosing);
        }
        catch (error) {
            console.error("Erro ao criar fechamento:", error);
            return rep.code(500).send({
                message: "Erro interno do servidor",
                error: error instanceof Error ? error.message : "Erro desconhecido"
            });
        }
    });
    // Atualizar fechamento
    app.put("/closings/:id", async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const data = updateClosingSchema.parse(req.body);
            // Atualizar fechamento usando Prisma ORM
            const updatedClosing = await prisma_1.prisma.closing.update({
                where: { id },
                data: {
                    name: data.name,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    status: data.status,
                },
                include: {
                    Month: {
                        select: {
                            id: true,
                            name: true,
                            year: true,
                            month: true,
                        },
                    },
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                },
            });
            return rep.send(updatedClosing);
        }
        catch (error) {
            console.error("Erro ao atualizar fechamento:", error);
            return rep.code(500).send({
                message: "Erro interno do servidor",
                error: error instanceof Error ? error.message : "Erro desconhecido"
            });
        }
    });
    // Deletar fechamento
    app.delete("/closings/:id", async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            // Verificar se o fechamento existe
            const closing = await prisma_1.prisma.closing.findUnique({
                where: { id },
            });
            if (!closing) {
                return rep.code(404).send({ message: "Fechamento não encontrado" });
            }
            if (closing.status === 'fechado') {
                return rep.code(400).send({
                    message: "Não é possível deletar um fechamento que já foi fechado"
                });
            }
            await prisma_1.prisma.closing.delete({
                where: { id },
            });
            return rep.send({ message: "Fechamento deletado com sucesso" });
        }
        catch (error) {
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Fechar fechamento (calcular totais)
    app.post("/closings/:id/close", async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const closing = await prisma_1.prisma.closing.findUnique({
                where: { id },
                include: {
                    FinancialEntry: true,
                },
            });
            if (!closing) {
                return rep.code(404).send({ message: "Fechamento não encontrado" });
            }
            if (closing.status === 'fechado') {
                return rep.code(400).send({ message: "Fechamento já está fechado" });
            }
            // Calcular totais reais
            const totalEntries = closing.FinancialEntry
                .filter(e => e.type === 'entrada')
                .reduce((sum, e) => sum + e.amount, 0);
            const totalExpenses = closing.FinancialEntry
                .filter(e => e.type === 'saida')
                .reduce((sum, e) => sum + e.amount, 0);
            const totalTaxes = closing.FinancialEntry
                .filter(e => e.type === 'imposto')
                .reduce((sum, e) => sum + e.amount, 0);
            const balance = totalEntries - totalExpenses - totalTaxes;
            const profitMargin = totalEntries > 0 ? (balance / totalEntries) * 100 : 0;
            // Atualizar fechamento
            const updatedClosing = await prisma_1.prisma.closing.update({
                where: { id },
                data: {
                    status: 'fechado',
                    totalEntries,
                    totalExpenses,
                    totalTaxes,
                    balance,
                    profitMargin,
                },
                include: {
                    Month: {
                        select: {
                            id: true,
                            name: true,
                            year: true,
                            month: true,
                        },
                    },
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                },
            });
            return rep.send(updatedClosing);
        }
        catch (error) {
            console.error("Erro ao fechar fechamento:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Reabrir fechamento
    app.post("/closings/:id/reopen", async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const closing = await prisma_1.prisma.closing.findUnique({
                where: { id },
            });
            if (!closing) {
                return rep.code(404).send({ message: "Fechamento não encontrado" });
            }
            if (closing.status !== 'fechado') {
                return rep.code(400).send({ message: "Apenas fechamentos fechados podem ser reabertos" });
            }
            const updatedClosing = await prisma_1.prisma.closing.update({
                where: { id },
                data: {
                    status: 'aberto',
                },
                include: {
                    Month: {
                        select: {
                            id: true,
                            name: true,
                            year: true,
                            month: true,
                        },
                    },
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                },
            });
            // Formatar resposta para manter compatibilidade com o frontend
            const formattedClosing = {
                ...updatedClosing,
                monthName: updatedClosing.Month?.name,
                monthYear: updatedClosing.Month?.year,
                monthNumber: updatedClosing.Month?.month,
                companyName: updatedClosing.Company?.name,
                companyCnpj: updatedClosing.Company?.cnpj,
            };
            return rep.send(formattedClosing);
        }
        catch (error) {
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Obter entradas financeiras de um fechamento
    app.get("/closings/:id/entries", async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const closing = await prisma_1.prisma.closing.findUnique({
                where: { id },
                include: {
                    FinancialEntry: {
                        include: {
                            Company: {
                                select: {
                                    id: true,
                                    name: true,
                                    cnpj: true,
                                },
                            },
                        },
                        orderBy: { date: 'desc' },
                    },
                },
            });
            if (!closing) {
                return rep.code(404).send({ message: "Fechamento não encontrado" });
            }
            return rep.send({
                closing: {
                    id: closing.id,
                    name: closing.name,
                    status: closing.status,
                    startDate: closing.startDate,
                    endDate: closing.endDate,
                    totalEntries: closing.totalEntries,
                    totalExpenses: closing.totalExpenses,
                    totalTaxes: closing.totalTaxes,
                    balance: closing.balance,
                    profitMargin: closing.profitMargin,
                },
                entries: closing.FinancialEntry,
            });
        }
        catch (error) {
            console.error("Erro ao buscar entradas do fechamento:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Obter estatísticas do fechamento
    app.get("/closings/:id/stats", async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const closing = await prisma_1.prisma.closing.findUnique({
                where: { id },
                include: {
                    FinancialEntry: true,
                    Month: true,
                    Company: true,
                },
            });
            if (!closing) {
                return rep.code(404).send({ message: "Fechamento não encontrado" });
            }
            // Calcular estatísticas
            const totalEntries = closing.FinancialEntry.filter(e => e.type === 'entrada').length;
            const totalExpenses = closing.FinancialEntry.filter(e => e.type === 'saida').length;
            const totalTaxes = closing.FinancialEntry.filter(e => e.type === 'imposto').length;
            const entriesByCategory = closing.FinancialEntry.reduce((acc, entry) => {
                acc[entry.category] = (acc[entry.category] || 0) + 1;
                return acc;
            }, {});
            return rep.send({
                closing: {
                    id: closing.id,
                    name: closing.name,
                    status: closing.status,
                    startDate: closing.startDate,
                    endDate: closing.endDate,
                },
                stats: {
                    totalEntries: closing.totalEntries,
                    totalExpenses: closing.totalExpenses,
                    totalTaxes: closing.totalTaxes,
                    balance: closing.balance,
                    profitMargin: closing.profitMargin,
                    entriesCount: {
                        entries: totalEntries,
                        expenses: totalExpenses,
                        taxes: totalTaxes,
                    },
                    entriesByCategory,
                },
            });
        }
        catch (error) {
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
}
exports.closingRoutes = closingRoutes;

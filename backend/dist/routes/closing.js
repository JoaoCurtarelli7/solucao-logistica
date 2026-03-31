"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closingRoutes = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissionMiddleware_1 = require("../middlewares/permissionMiddleware");
async function closingRoutes(app) {
    app.addHook("preHandler", authMiddleware_1.authMiddleware);
    // Schema para validação de fechamento
    const createClosingSchema = zod_1.z.object({
        monthId: zod_1.z.number(),
        companyId: zod_1.z.preprocess((v) => (v === "" || v === undefined || v === "null" ? undefined : Number(v)), zod_1.z.number().nullable().optional()),
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
    app.get("/closings", { preHandler: (0, permissionMiddleware_1.requirePermission)("closings.view") }, async (req, rep) => {
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
                    FinancialEntry: {
                        select: { type: true, amount: true },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
            // Calcular total de salários por mês (base + créditos - débitos) para incluir nas saídas
            const salaryByMonth = new Map();
            const uniqueMonths = new Map();
            for (const c of closings) {
                const m = c.Month;
                if (m?.year != null && m?.month != null) {
                    uniqueMonths.set(`${m.year}-${m.month}`, { year: m.year, month: m.month });
                }
            }
            for (const [, { year, month }] of uniqueMonths) {
                const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
                const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
                const employees = await prisma_1.prisma.employee.findMany({
                    where: { status: "Ativo" },
                    include: {
                        Transaction: {
                            where: { date: { gte: startOfMonth, lte: endOfMonth } },
                        },
                    },
                });
                let total = 0;
                for (const emp of employees) {
                    const credits = (emp.Transaction ?? [])
                        .filter((t) => t.type === "Crédito" || t.type === "Credito")
                        .reduce((s, t) => s + Number(t.amount || 0), 0);
                    const debits = (emp.Transaction ?? [])
                        .filter((t) => t.type === "Débito" || t.type === "Debito")
                        .reduce((s, t) => s + Number(t.amount || 0), 0);
                    const finalSalary = Number(emp.baseSalary || 0) + credits - debits;
                    if (finalSalary > 0)
                        total += finalSalary;
                }
                salaryByMonth.set(`${year}-${month}`, total);
            }
            const formattedClosings = closings.map((c) => {
                const entries = c.FinancialEntry || [];
                const entriesSaida = entries.filter((e) => e.category !== "Salários");
                const totalEntries = entries.filter((e) => e.type === "entrada").reduce((s, e) => s + e.amount, 0);
                let totalExpenses = entriesSaida.filter((e) => e.type === "saida").reduce((s, e) => s + e.amount, 0);
                const m = c.Month;
                if (m?.year != null && m?.month != null) {
                    totalExpenses += salaryByMonth.get(`${m.year}-${m.month}`) ?? 0;
                }
                const totalTaxes = entries.filter((e) => e.type === "imposto").reduce((s, e) => s + e.amount, 0);
                const balance = totalEntries - totalExpenses - totalTaxes;
                const profitMargin = totalEntries > 0 ? (balance / totalEntries) * 100 : 0;
                const { FinancialEntry, ...rest } = c;
                return {
                    ...rest,
                    monthName: c.Month?.name,
                    monthYear: c.Month?.year,
                    monthNumber: c.Month?.month,
                    companyName: c.Company?.name,
                    companyCnpj: c.Company?.cnpj,
                    totalEntries,
                    totalExpenses,
                    totalTaxes,
                    balance,
                    profitMargin,
                };
            });
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
    app.get("/closings/:id", { preHandler: (0, permissionMiddleware_1.requirePermission)("closings.view") }, async (req, rep) => {
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
    app.post("/closings", { preHandler: (0, permissionMiddleware_1.requirePermission)("closings.create") }, async (req, rep) => {
        try {
            const data = createClosingSchema.parse(req.body);
            // Garantir companyId null quando não informado (Todas as empresas)
            const companyId = data.companyId === undefined ? null : data.companyId;
            // Verificar se o mês existe
            const month = await prisma_1.prisma.month.findUnique({
                where: { id: data.monthId },
            });
            if (!month) {
                return rep.code(404).send({ message: "Mês não encontrado" });
            }
            // Verificar se a empresa existe (se fornecida) e obter dados (inclui comissão)
            let company = null;
            if (companyId != null) {
                const foundCompany = await prisma_1.prisma.company.findUnique({
                    where: { id: companyId },
                    select: {
                        id: true,
                        name: true,
                        commission: true,
                    },
                });
                if (!foundCompany) {
                    return rep.code(404).send({ message: "Empresa não encontrada" });
                }
                company = foundCompany;
            }
            // Criar fechamento usando Prisma ORM em vez de SQL bruto
            const closingData = {
                monthId: data.monthId,
                companyId,
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
            if (error?.name === "ZodError" && error?.errors) {
                const msg = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
                return rep.code(400).send({ message: msg });
            }
            return rep.code(500).send({
                message: "Erro interno do servidor",
                error: error instanceof Error ? error.message : "Erro desconhecido"
            });
        }
    });
    // Atualizar fechamento
    app.put("/closings/:id", { preHandler: (0, permissionMiddleware_1.requirePermission)("closings.update") }, async (req, rep) => {
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
    app.delete("/closings/:id", { preHandler: (0, permissionMiddleware_1.requirePermission)("closings.delete") }, async (req, rep) => {
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
    app.post("/closings/:id/reopen", { preHandler: (0, permissionMiddleware_1.requirePermission)("closings.update") }, async (req, rep) => {
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
    app.get("/closings/:id/entries", { preHandler: (0, permissionMiddleware_1.requirePermission)("closings.view") }, async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const closing = await prisma_1.prisma.closing.findUnique({
                where: { id },
                include: {
                    Month: { select: { id: true, year: true, month: true } },
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
            // Salários: usar o mês do fechamento (Month) para pegar créditos/débitos corretos
            const salaryEntries = [];
            const monthData = closing.Month;
            const targetYear = monthData?.year;
            const targetMonth = monthData?.month;
            if (targetYear != null && targetMonth != null) {
                const startOfMonth = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
                const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
                const employees = await prisma_1.prisma.employee.findMany({
                    where: { status: "Ativo" },
                    include: {
                        Transaction: {
                            where: {
                                date: { gte: startOfMonth, lte: endOfMonth },
                            },
                        },
                    },
                });
                for (const emp of employees) {
                    const credits = (emp.Transaction ?? [])
                        .filter((t) => (t.type === "Crédito" || t.type === "Credito"))
                        .reduce((s, t) => s + Number(t.amount || 0), 0);
                    const debits = (emp.Transaction ?? [])
                        .filter((t) => (t.type === "Débito" || t.type === "Debito"))
                        .reduce((s, t) => s + Number(t.amount || 0), 0);
                    const finalSalary = Number(emp.baseSalary || 0) + credits - debits;
                    if (finalSalary > 0) {
                        salaryEntries.push({
                            id: `salary-${emp.id}`,
                            description: `Salário - ${emp.name} (${targetMonth.toString().padStart(2, "0")}/${targetYear})`,
                            amount: finalSalary,
                            category: "Salários",
                            date: endOfMonth,
                            type: "saida",
                            observations: null,
                            closingId: closing.id,
                            companyId: null,
                            _isComputed: true,
                            Company: null,
                        });
                    }
                }
            }
            const manualEntries = (closing.FinancialEntry ?? []).filter((e) => e.category !== "Salários");
            const allEntries = [
                ...manualEntries,
                ...salaryEntries,
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
                entries: allEntries,
            });
        }
        catch (error) {
            console.error("Erro ao buscar entradas do fechamento:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Obter estatísticas do fechamento
    app.get("/closings/:id/stats", { preHandler: (0, permissionMiddleware_1.requirePermission)("closings.view") }, async (req, rep) => {
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

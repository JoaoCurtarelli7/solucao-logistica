"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financialRoutes = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
async function financialRoutes(app) {
    // Autenticação desativada temporariamente para facilitar testes de integração do financeiro
    // app.addHook("preHandler", authenticate);
    // Schema para validação de entrada financeira
    const createEntrySchema = zod_1.z.object({
        description: zod_1.z.string().min(3, "Descrição deve ter pelo menos 3 caracteres").max(255, "Descrição deve ter no máximo 255 caracteres"),
        amount: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).transform((val) => {
            let num;
            if (typeof val === 'string') {
                // Remover caracteres especiais e converter vírgula para ponto
                const cleaned = val.replace(/[^\d,.-]/g, '').replace(',', '.');
                num = parseFloat(cleaned);
            }
            else {
                num = val;
            }
            if (isNaN(num) || num <= 0) {
                throw new Error("Valor deve ser maior que zero");
            }
            return num;
        }),
        category: zod_1.z.string().min(1, "Categoria é obrigatória").max(100, "Categoria deve ter no máximo 100 caracteres"),
        date: zod_1.z.string().transform((str) => {
            // Converter DD/MM/YYYY para Date
            const [day, month, year] = str.split('/');
            if (!day || !month || !year) {
                throw new Error("Formato de data inválido. Use DD/MM/YYYY");
            }
            const dayNum = parseInt(day);
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);
            // Verificação básica de validade
            if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2100) {
                throw new Error("Data inválida. Verifique os valores inseridos.");
            }
            const date = new Date(yearNum, monthNum - 1, dayNum);
            // Verificar se a data criada é válida
            if (date.getFullYear() !== yearNum || date.getMonth() !== monthNum - 1 || date.getDate() !== dayNum) {
                throw new Error("Data inválida. Esta data não existe no calendário.");
            }
            return date;
        }),
        companyId: zod_1.z.number().optional().nullable(),
        closingId: zod_1.z.number().optional().nullable(),
        type: zod_1.z.enum(["entrada", "saida", "imposto"], {
            errorMap: () => ({ message: "Tipo deve ser 'entrada', 'saida' ou 'imposto'" })
        }),
        observations: zod_1.z.string().optional().nullable().transform((val) => val || null),
    });
    // Schema para validação de período financeiro
    const createPeriodSchema = zod_1.z.object({
        name: zod_1.z.string().min(1, "Nome do período é obrigatório"),
        startDate: zod_1.z.string().transform((str) => new Date(str)),
        endDate: zod_1.z.string().transform((str) => new Date(str)),
        companyId: zod_1.z.number().optional(),
    });
    // Schema para validação de filtros
    const filterSchema = zod_1.z.object({
        startDate: zod_1.z.string().optional().transform((str) => str ? new Date(str) : undefined),
        endDate: zod_1.z.string().optional().transform((str) => str ? new Date(str) : undefined),
        companyId: zod_1.z.number().optional(),
        type: zod_1.z.enum(["entrada", "saida", "imposto"]).optional(),
        category: zod_1.z.string().optional(),
    });
    // Criar nova entrada financeira
    app.post("/financial/entries", async (req, rep) => {
        try {
            const data = createEntrySchema.parse(req.body);
            const entry = await prisma_1.prisma.financialEntry.create({
                data: {
                    description: data.description,
                    amount: data.amount,
                    category: data.category,
                    date: data.date,
                    companyId: data.companyId,
                    closingId: data.closingId,
                    type: data.type,
                    observations: data.observations,
                },
                include: {
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                },
            });
            return rep.code(201).send(entry);
        }
        catch (error) {
            console.error("Erro ao criar entrada financeira:", error);
            if (error instanceof zod_1.z.ZodError) {
                return rep.code(400).send({
                    message: "Dados inválidos",
                    errors: error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
            }
            return rep.code(400).send({
                message: "Erro ao criar entrada financeira",
                error: error instanceof Error ? error.message : "Erro desconhecido"
            });
        }
    });
    // Listar entradas financeiras com filtros
    app.get("/financial/entries", async (req, rep) => {
        try {
            const { startDate, endDate, companyId, type, category } = filterSchema.parse(req.query);
            const where = {};
            if (startDate && endDate) {
                where.date = {
                    gte: startDate,
                    lte: endDate,
                };
            }
            if (companyId) {
                where.companyId = companyId;
            }
            if (type) {
                where.type = type;
            }
            if (category) {
                where.category = category;
            }
            const entries = await prisma_1.prisma.financialEntry.findMany({
                where,
                include: {
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                },
                orderBy: {
                    date: "desc",
                },
            });
            return { entries };
        }
        catch (error) {
            console.error("Erro ao buscar entradas financeiras:", error);
            return rep.code(400).send({
                message: "Erro ao buscar entradas financeiras",
                error: error instanceof Error ? error.message : "Erro desconhecido"
            });
        }
    });
    // Buscar entrada financeira por ID
    app.get("/financial/entries/:id", async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const entry = await prisma_1.prisma.financialEntry.findUnique({
                where: { id },
                include: {
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                },
            });
            if (!entry) {
                return rep.code(404).send({ message: "Entrada financeira não encontrada" });
            }
            return entry;
        }
        catch (error) {
            console.error("Erro ao buscar entrada financeira:", error);
            return rep.code(400).send({
                message: "Erro ao buscar entrada financeira",
                error: error instanceof Error ? error.message : "Erro desconhecido"
            });
        }
    });
    // Atualizar entrada financeira
    app.put("/financial/entries/:id", async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const data = createEntrySchema.parse(req.body);
            const entry = await prisma_1.prisma.financialEntry.update({
                where: { id },
                data: {
                    description: data.description,
                    amount: data.amount,
                    category: data.category,
                    date: data.date,
                    companyId: data.companyId,
                    closingId: data.closingId,
                    type: data.type,
                    observations: data.observations,
                },
                include: {
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                },
            });
            return entry;
        }
        catch (error) {
            console.error("Erro ao atualizar entrada financeira:", error);
            return rep.code(400).send({
                message: "Erro ao atualizar entrada financeira",
                error: error instanceof Error ? error.message : "Erro desconhecido"
            });
        }
    });
    // Deletar entrada financeira
    app.delete("/financial/entries/:id", async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            await prisma_1.prisma.financialEntry.delete({
                where: { id },
            });
            return { message: "Entrada financeira deletada com sucesso" };
        }
        catch (error) {
            console.error("Erro ao deletar entrada financeira:", error);
            return rep.code(400).send({
                message: "Erro ao deletar entrada financeira",
                error: error instanceof Error ? error.message : "Erro desconhecido"
            });
        }
    });
    // Resumo financeiro por período
    app.get("/financial/summary", async (req, rep) => {
        try {
            const { startDate, endDate, companyId } = filterSchema.parse(req.query);
            if (!startDate || !endDate) {
                return rep.code(400).send({
                    message: "Data de início e fim são obrigatórias para o resumo"
                });
            }
            const where = {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            };
            if (companyId) {
                where.companyId = companyId;
            }
            const entries = await prisma_1.prisma.financialEntry.findMany({ where });
            const totalEntries = entries
                .filter(e => e.type === "entrada")
                .reduce((sum, e) => sum + e.amount, 0);
            const totalExpenses = entries
                .filter(e => e.type === "saida")
                .reduce((sum, e) => sum + e.amount, 0);
            const totalTaxes = entries
                .filter(e => e.type === "imposto")
                .reduce((sum, e) => sum + e.amount, 0);
            const balance = totalEntries - totalExpenses - totalTaxes;
            const profitMargin = totalEntries > 0 ? (balance / totalEntries) * 100 : 0;
            return {
                period: {
                    startDate,
                    endDate,
                },
                summary: {
                    totalEntries,
                    totalExpenses,
                    totalTaxes,
                    balance,
                    profitMargin,
                },
                entries: entries.length,
            };
        }
        catch (error) {
            console.error("Erro ao gerar resumo financeiro:", error);
            return rep.code(400).send({
                message: "Erro ao gerar resumo financeiro",
                error: error instanceof Error ? error.message : "Erro desconhecido"
            });
        }
    });
    // Criar período financeiro
    app.post("/financial/periods", async (req, rep) => {
        try {
            const data = createPeriodSchema.parse(req.body);
            const period = await prisma_1.prisma.financialPeriod.create({
                data: {
                    name: data.name,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    companyId: data.companyId,
                },
                include: {
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                },
            });
            return rep.code(201).send(period);
        }
        catch (error) {
            console.error("Erro ao criar período financeiro:", error);
            return rep.code(400).send({
                message: "Erro ao criar período financeiro",
                error: error instanceof Error ? error.message : "Erro desconhecido"
            });
        }
    });
    // Listar períodos financeiros
    app.get("/financial/periods", async (req, rep) => {
        try {
            const { companyId } = filterSchema.parse(req.query);
            const where = {};
            if (companyId) {
                where.companyId = companyId;
            }
            const periods = await prisma_1.prisma.financialPeriod.findMany({
                where,
                include: {
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                },
                orderBy: {
                    startDate: "desc",
                },
            });
            return { periods };
        }
        catch (error) {
            console.error("Erro ao buscar períodos financeiros:", error);
            return rep.code(400).send({
                message: "Erro ao buscar períodos financeiros",
                error: error instanceof Error ? error.message : "Erro desconhecido"
            });
        }
    });
    // Fechar período financeiro
    app.post("/financial/periods/:id/close", async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const period = await prisma_1.prisma.financialPeriod.findUnique({
                where: { id },
                include: {
                    Company: true,
                },
            });
            if (!period) {
                return rep.code(404).send({ message: "Período financeiro não encontrado" });
            }
            // Calcular totais do período
            const entries = await prisma_1.prisma.financialEntry.findMany({
                where: {
                    companyId: period.companyId,
                    date: {
                        gte: period.startDate,
                        lte: period.endDate,
                    },
                },
            });
            const totalEntries = entries
                .filter(e => e.type === "entrada")
                .reduce((sum, e) => sum + e.amount, 0);
            const totalExpenses = entries
                .filter(e => e.type === "saida")
                .reduce((sum, e) => sum + e.amount, 0);
            const totalTaxes = entries
                .filter(e => e.type === "imposto")
                .reduce((sum, e) => sum + e.amount, 0);
            const balance = totalEntries - totalExpenses - totalTaxes;
            const profitMargin = totalEntries > 0 ? (balance / totalEntries) * 100 : 0;
            const updatedPeriod = await prisma_1.prisma.financialperiod.update({
                where: { id },
                data: {
                    status: "fechado",
                    totalEntries,
                    totalExpenses,
                    totalTaxes,
                    balance,
                    profitMargin,
                },
                include: {
                    Company: {
                        select: {
                            id: true,
                            name: true,
                            cnpj: true,
                        },
                    },
                },
            });
            return updatedPeriod;
        }
        catch (error) {
            console.error("Erro ao fechar período financeiro:", error);
            return rep.code(400).send({
                message: "Erro ao fechar período financeiro",
                error: error instanceof Error ? error.message : "Erro desconhecido"
            });
        }
    });
}
exports.financialRoutes = financialRoutes;

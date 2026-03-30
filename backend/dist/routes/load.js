"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRoutes = loadRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middlewares/authMiddleware");
function parseMaybeBrDateToDate(d) {
    if (d instanceof Date)
        return d;
    const s = String(d ?? "").trim();
    if (!s)
        return new Date();
    if (s.includes("/")) {
        const [day, month, year] = s.split("/");
        return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return new Date(s);
}
function formatDateBR(d) {
    const date = d instanceof Date ? d : new Date(d);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}
function loadEntryDescription(loadingNumber, loadDate) {
    return `Carga: ${loadingNumber} - ${formatDateBR(loadDate)}`;
}
async function loadRoutes(app) {
    const paramsSchema = zod_1.z.object({ id: zod_1.z.coerce.number() });
    const companyParamsSchema = zod_1.z.object({ companyId: zod_1.z.coerce.number() });
    const bodySchema = zod_1.z.object({
        date: zod_1.z
            .union([zod_1.z.coerce.date(), zod_1.z.string()])
            .transform(parseMaybeBrDateToDate),
        loadingNumber: zod_1.z.string().min(1),
        deliveries: zod_1.z.coerce.number(),
        cargoWeight: zod_1.z.coerce.number(),
        totalValue: zod_1.z.coerce.number(),
        freight4: zod_1.z.coerce.number(),
        totalFreight: zod_1.z.coerce.number(),
        additionalCosts: zod_1.z.coerce.number().optional().default(0),
        additionalCostsNote: zod_1.z.string().optional(),
        observations: zod_1.z.string().optional(),
        companyId: zod_1.z.coerce.number(),
    });
    const updateBodySchema = zod_1.z.object({
        date: zod_1.z
            .union([zod_1.z.coerce.date(), zod_1.z.string()])
            .transform(parseMaybeBrDateToDate)
            .optional(),
        loadingNumber: zod_1.z.string().min(1).optional(),
        deliveries: zod_1.z.coerce.number().optional(),
        cargoWeight: zod_1.z.coerce.number().optional(),
        totalValue: zod_1.z.coerce.number().optional(),
        freight4: zod_1.z.coerce.number().optional(),
        totalFreight: zod_1.z.coerce.number().optional(),
        additionalCosts: zod_1.z.coerce.number().optional(),
        additionalCostsNote: zod_1.z.string().optional(),
        observations: zod_1.z.string().optional(),
        companyId: zod_1.z.coerce.number().optional(),
    });
    // protege todas as rotas deste módulo
    app.addHook("preHandler", authMiddleware_1.authMiddleware);
    // LISTAR
    app.get("/loads", async (_req, rep) => {
        try {
            const loads = await prisma_1.prisma.load.findMany({
                include: {
                    Company: {
                        select: { id: true, name: true, cnpj: true, commission: true },
                    },
                },
                orderBy: { date: "desc" },
            });
            return rep.send(loads);
        }
        catch (error) {
            app.log.error(error);
            return rep
                .code(500)
                .send({ message: "Erro interno ao buscar os carregamentos" });
        }
    });
    // LISTAR POR EMPRESA
    app.get("/loads/company/:companyId", async (req, rep) => {
        const { companyId } = companyParamsSchema.parse(req.params);
        try {
            await prisma_1.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
            const loads = await prisma_1.prisma.load.findMany({
                where: { companyId },
                include: {
                    Company: {
                        select: { id: true, name: true, cnpj: true, commission: true },
                    },
                },
                orderBy: { date: "desc" },
            });
            return rep.send(loads);
        }
        catch (error) {
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
    });
    // POR ID
    app.get("/loads/:id", async (req, rep) => {
        const { id } = paramsSchema.parse(req.params);
        try {
            const load = await prisma_1.prisma.load.findUnique({
                where: { id },
                include: {
                    Company: {
                        select: { id: true, name: true, cnpj: true, commission: true },
                    },
                },
            });
            if (!load)
                return rep.code(404).send({ message: "Carregamento não encontrado" });
            return rep.send(load);
        }
        catch (error) {
            app.log.error(error);
            return rep
                .code(500)
                .send({ message: "Erro interno ao buscar o carregamento" });
        }
    });
    // CRIAR
    app.post("/loads", async (req, rep) => {
        const { date, loadingNumber, deliveries, cargoWeight, totalValue, freight4, totalFreight, additionalCosts, additionalCostsNote, observations, companyId, } = bodySchema.parse(req.body);
        try {
            await prisma_1.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
            const existing = await prisma_1.prisma.load.findFirst({
                where: { loadingNumber, companyId },
                select: { id: true },
            });
            if (existing) {
                return rep
                    .code(400)
                    .send({
                    message: "Já existe um carregamento com este número para esta empresa",
                });
            }
            const load = await prisma_1.prisma.load.create({
                data: {
                    date,
                    loadingNumber,
                    deliveries,
                    cargoWeight,
                    totalValue,
                    freight4,
                    totalFreight,
                    additionalCosts: Math.max(0, additionalCosts ?? 0),
                    additionalCostsNote: additionalCostsNote?.trim()
                        ? additionalCostsNote.trim()
                        : null,
                    observations: observations?.trim() ? observations : null,
                    Company: { connect: { id: companyId } },
                },
                include: {
                    Company: {
                        select: { id: true, name: true, cnpj: true, commission: true },
                    },
                },
            });
            return rep.code(201).send(load);
        }
        catch (error) {
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
    app.put("/loads/:id", async (req, rep) => {
        const { id } = paramsSchema.parse(req.params);
        const updateData = updateBodySchema.parse(req.body);
        try {
            const existing = await prisma_1.prisma.load.findUnique({ where: { id } });
            if (!existing)
                return rep.code(404).send({ message: "Carregamento não encontrado" });
            if (updateData.companyId) {
                await prisma_1.prisma.company.findUniqueOrThrow({
                    where: { id: updateData.companyId },
                });
            }
            if (updateData.loadingNumber &&
                (updateData.companyId ?? existing.companyId)) {
                const targetCompanyId = updateData.companyId ?? existing.companyId;
                const duplicate = await prisma_1.prisma.load.findFirst({
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
                        message: "Já existe um carregamento com este número para esta empresa",
                    });
                }
            }
            const data = {
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
            const updated = await prisma_1.prisma.load.update({
                where: { id },
                data,
                include: {
                    Company: {
                        select: { id: true, name: true, cnpj: true, commission: true },
                    },
                },
            });
            return rep.send(updated);
        }
        catch (error) {
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
    app.delete("/loads/:id", async (req, rep) => {
        const { id } = paramsSchema.parse(req.params);
        try {
            const existing = await prisma_1.prisma.load.findUnique({ where: { id } });
            if (!existing)
                return rep.code(404).send({ message: "Carregamento não encontrado" });
            // Remover entradas do fechamento que referenciam esta carga
            const desc = loadEntryDescription(existing.loadingNumber, existing.date);
            await prisma_1.prisma.financialEntry.deleteMany({
                where: {
                    companyId: existing.companyId,
                    type: "entrada",
                    category: "Comissões",
                    description: desc,
                },
            });
            await prisma_1.prisma.load.delete({ where: { id } });
            return rep.code(204).send();
        }
        catch (error) {
            app.log.error(error);
            return rep
                .code(500)
                .send({ message: "Erro interno ao deletar o carregamento" });
        }
    });
    // POR PERÍODO
    app.get("/loads/period", async (req, rep) => {
        const querySchema = zod_1.z.object({
            startDate: zod_1.z
                .union([zod_1.z.coerce.date(), zod_1.z.string()])
                .transform(parseMaybeBrDateToDate),
            endDate: zod_1.z
                .union([zod_1.z.coerce.date(), zod_1.z.string()])
                .transform(parseMaybeBrDateToDate),
            companyId: zod_1.z.coerce.number().optional(),
        });
        try {
            const { startDate, endDate, companyId } = querySchema.parse(req.query);
            const where = {
                date: { gte: startDate, lte: endDate },
                ...(companyId ? { companyId } : {}),
            };
            const loads = await prisma_1.prisma.load.findMany({
                where,
                include: {
                    Company: {
                        select: { id: true, name: true, cnpj: true, commission: true },
                    },
                },
                orderBy: { date: "desc" },
            });
            return rep.send(loads);
        }
        catch (error) {
            app.log.error(error);
            return rep
                .code(500)
                .send({ message: "Erro interno ao buscar carregamentos por período" });
        }
    });
}

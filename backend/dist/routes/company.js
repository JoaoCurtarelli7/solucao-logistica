"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyRoutes = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middlewares/authMiddleware");
async function companyRoutes(app) {
    const paramsSchema = zod_1.z.object({
        id: zod_1.z.coerce.number(),
    });
    const bodySchema = zod_1.z.object({
        name: zod_1.z.string(),
        type: zod_1.z.string(),
        cnpj: zod_1.z.string(),
        dateRegistration: zod_1.z.coerce.date(),
        status: zod_1.z.enum(["Ativo", "Inativo"]),
        responsible: zod_1.z.string(),
        commission: zod_1.z.coerce.number(),
    });
    // Listar todas as empresas (rota pública para permitir seleção)
    app.get("/companies", async (req, rep) => {
        try {
            const companies = await prisma_1.prisma.company.findMany({
                select: {
                    id: true,
                    name: true,
                    type: true,
                    cnpj: true,
                    dateRegistration: true,
                    status: true,
                    responsible: true,
                    commission: true,
                },
                orderBy: {
                    name: 'asc',
                },
            });
            return rep.send(companies);
        }
        catch (error) {
            console.error("❌ Erro ao buscar empresas:", error);
            console.error("Detalhes:", {
                message: error?.message,
                code: error?.code,
                meta: error?.meta,
            });
            return rep.code(500).send({
                message: "Erro ao buscar empresas",
                error: process.env.NODE_ENV === 'development' ? error?.message : undefined
            });
        }
    });
    // 🔒 Protege as rotas restantes da empresa
    app.addHook("preHandler", authMiddleware_1.authenticate);
    // Obter uma empresa pelo ID
    app.get("/company/:id", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            const company = await prisma_1.prisma.company.findUniqueOrThrow({
                where: { id },
            });
            return rep.send(company);
        }
        catch (error) {
            if (error.code === "P2025") {
                return rep.code(404).send({ message: "Empresa não encontrada" });
            }
            console.error("❌ Erro ao buscar empresa:", error);
            return rep.code(500).send({
                message: "Erro interno do servidor",
                error: process.env.NODE_ENV === 'development' ? error?.message : undefined
            });
        }
    });
    // Criar uma nova empresa
    app.post("/company", async (req, rep) => {
        const { name, type, cnpj, dateRegistration, status, responsible, commission } = bodySchema.parse(req.body);
        try {
            const company = await prisma_1.prisma.company.create({
                data: { name, type, cnpj, dateRegistration, status, responsible, commission },
            });
            return rep.code(201).send(company);
        }
        catch (error) {
            if (error.code === "P2002" && error.meta?.target?.includes("cnpj")) {
                return rep.code(400).send({ message: "Já existe uma empresa cadastrada com este CNPJ" });
            }
            console.error("Erro ao criar empresa:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Atualizar uma empresa existente
    app.put("/company/:id", async (req, rep) => {
        const { id } = paramsSchema.parse(req.params);
        const { name, type, cnpj, dateRegistration, status, responsible, commission } = bodySchema.parse(req.body);
        try {
            await prisma_1.prisma.company.findUniqueOrThrow({ where: { id } });
            const updatedCompany = await prisma_1.prisma.company.update({
                where: { id },
                data: { name, type, cnpj, dateRegistration, status, responsible, commission },
            });
            return rep.send(updatedCompany);
        }
        catch (error) {
            if (error.code === "P2002" && error.meta?.target?.includes("cnpj")) {
                return rep.code(400).send({ message: "Já existe uma empresa cadastrada com este CNPJ" });
            }
            console.error("Erro ao atualizar empresa:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Deletar uma empresa
    app.delete("/company/:id", async (req, rep) => {
        const { id } = paramsSchema.parse(req.params);
        try {
            const company = await prisma_1.prisma.company.delete({ where: { id } });
            return company;
        }
        catch (error) {
            console.error("Erro ao deletar empresa:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
}
exports.companyRoutes = companyRoutes;

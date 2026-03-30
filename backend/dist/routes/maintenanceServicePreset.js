"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maintenanceServicePresetRoutes = maintenanceServicePresetRoutes;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissionMiddleware_1 = require("../middlewares/permissionMiddleware");
function prismaCatalogErrorMessage(error) {
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2021") {
            return ("Tabela do catálogo não existe no banco. No diretório backend, execute: npx prisma migrate deploy && npx prisma generate e reinicie o servidor.");
        }
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (/does not exist|relation .* does not exist|Unknown table/i.test(msg)) {
        return ("Tabela do catálogo não encontrada. No diretório backend: npx prisma migrate deploy && npx prisma generate");
    }
    return null;
}
async function maintenanceServicePresetRoutes(app) {
    app.addHook("preHandler", authMiddleware_1.authMiddleware);
    // Listar serviços do catálogo (padrão + salvos)
    app.get("/maintenance-service-presets", { preHandler: (0, permissionMiddleware_1.requirePermission)("maintenance.view") }, async (_req, rep) => {
        try {
            const presets = await prisma_1.prisma.maintenanceServicePreset.findMany({
                orderBy: [{ isDefault: "desc" }, { name: "asc" }],
            });
            return rep.send(presets);
        }
        catch (error) {
            console.error("Erro ao listar serviços de manutenção:", error);
            const hint = prismaCatalogErrorMessage(error);
            return rep.code(500).send({
                message: hint ?? "Erro ao listar serviços",
            });
        }
    });
    // Obter serviço por ID
    app.get("/maintenance-service-presets/:id", { preHandler: (0, permissionMiddleware_1.requirePermission)("maintenance.view") }, async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const preset = await prisma_1.prisma.maintenanceServicePreset.findUnique({ where: { id } });
            if (!preset)
                return rep.code(404).send({ message: "Serviço não encontrado" });
            return rep.send(preset);
        }
        catch (error) {
            console.error("Erro ao buscar serviço:", error);
            const hint = prismaCatalogErrorMessage(error);
            return rep.code(500).send({ message: hint ?? "Erro ao buscar serviço" });
        }
    });
    // Atualizar serviço
    app.put("/maintenance-service-presets/:id", { preHandler: (0, permissionMiddleware_1.requirePermission)("maintenance.update") }, async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const bodySchema = zod_1.z.object({
                name: zod_1.z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(200),
            });
            const { name } = bodySchema.parse(req.body);
            const trimmed = name.trim();
            const existing = await prisma_1.prisma.maintenanceServicePreset.findFirst({
                where: { name: trimmed, id: { not: id } },
            });
            if (existing) {
                return rep.code(400).send({ message: "Já existe um serviço com este nome" });
            }
            const preset = await prisma_1.prisma.maintenanceServicePreset.findUnique({ where: { id } });
            if (!preset)
                return rep.code(404).send({ message: "Serviço não encontrado" });
            if (preset.isDefault) {
                return rep.code(400).send({ message: "Não é possível editar serviços padrão do sistema" });
            }
            const updated = await prisma_1.prisma.maintenanceServicePreset.update({
                where: { id },
                data: { name: trimmed },
            });
            return rep.send(updated);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return rep.code(400).send({
                    message: "Dados inválidos",
                    errors: error.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
                });
            }
            console.error("Erro ao atualizar serviço:", error);
            const hint = prismaCatalogErrorMessage(error);
            return rep.code(500).send({ message: hint ?? "Erro ao atualizar serviço" });
        }
    });
    // Deletar serviço
    app.delete("/maintenance-service-presets/:id", { preHandler: (0, permissionMiddleware_1.requirePermission)("maintenance.delete") }, async (req, rep) => {
        try {
            const { id } = zod_1.z.object({ id: zod_1.z.coerce.number() }).parse(req.params);
            const preset = await prisma_1.prisma.maintenanceServicePreset.findUnique({ where: { id } });
            if (!preset)
                return rep.code(404).send({ message: "Serviço não encontrado" });
            if (preset.isDefault) {
                return rep.code(400).send({ message: "Não é possível deletar serviços padrão do sistema" });
            }
            await prisma_1.prisma.maintenanceServicePreset.delete({ where: { id } });
            return rep.send({ message: "Serviço deletado com sucesso" });
        }
        catch (error) {
            console.error("Erro ao deletar serviço:", error);
            const hint = prismaCatalogErrorMessage(error);
            return rep.code(500).send({ message: hint ?? "Erro ao deletar serviço" });
        }
    });
    // Adicionar novo serviço ao catálogo (fica salvo para todos)
    app.post("/maintenance-service-presets", { preHandler: (0, permissionMiddleware_1.requirePermission)("maintenance.create") }, async (req, rep) => {
        try {
            const bodySchema = zod_1.z.object({
                name: zod_1.z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(200),
            });
            const { name } = bodySchema.parse(req.body);
            const trimmed = name.trim();
            const existing = await prisma_1.prisma.maintenanceServicePreset.findUnique({
                where: { name: trimmed },
            });
            if (existing) {
                return rep.send(existing);
            }
            const created = await prisma_1.prisma.maintenanceServicePreset.create({
                data: { name: trimmed, isDefault: false },
            });
            return rep.code(201).send(created);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return rep.code(400).send({
                    message: "Dados inválidos",
                    errors: error.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
                });
            }
            console.error("Erro ao criar serviço de manutenção:", error);
            const hint = prismaCatalogErrorMessage(error);
            return rep.code(500).send({ message: hint ?? "Erro ao salvar serviço" });
        }
    });
}

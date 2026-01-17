"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maintenanceRoutes = maintenanceRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middlewares/authMiddleware");
async function maintenanceRoutes(app) {
    const paramsSchema = zod_1.z.object({ id: zod_1.z.coerce.number(), truckId: zod_1.z.coerce.number() });
    const bodySchema = zod_1.z.object({
        date: zod_1.z.coerce.date(),
        service: zod_1.z.string(),
        km: zod_1.z.coerce.number(),
        value: zod_1.z.coerce.number(),
        notes: zod_1.z.string().optional(),
        truckId: zod_1.z.coerce.number(),
    });
    app.addHook("preHandler", authMiddleware_1.authenticate);
    // Listar manutenção de um caminhão
    app.get("/maintenance/:truckId", async (req, rep) => {
        const { truckId } = paramsSchema.parse(req.params);
        try {
            const maintenances = await prisma_1.prisma.maintenance.findMany({ where: { truckId } });
            return maintenances;
        }
        catch (error) {
            console.error(error);
            return rep.code(500).send({ message: "Erro ao listar manutenções" });
        }
    });
    // Criar manutenção
    app.post("/maintenance", async (req, rep) => {
        const data = bodySchema.parse(req.body);
        try {
            const maintenance = await prisma_1.prisma.maintenance.create({ data });
            return rep.code(201).send(maintenance);
        }
        catch (error) {
            console.error(error);
            return rep.code(500).send({ message: "Erro ao criar manutenção" });
        }
    });
    // Atualizar manutenção
    app.put("/maintenance/:id", async (req, rep) => {
        const { id } = paramsSchema.parse(req.params);
        const data = bodySchema.parse(req.body);
        try {
            const maintenance = await prisma_1.prisma.maintenance.update({ where: { id }, data });
            return rep.send(maintenance);
        }
        catch (error) {
            console.error(error);
            return rep.code(500).send({ message: "Erro ao atualizar manutenção" });
        }
    });
    // Deletar manutenção
    app.delete("/maintenance/:id", async (req, rep) => {
        const { id } = paramsSchema.parse(req.params);
        try {
            await prisma_1.prisma.maintenance.delete({ where: { id } });
            return rep.code(204).send();
        }
        catch (error) {
            console.error(error);
            return rep.code(500).send({ message: "Erro ao deletar manutenção" });
        }
    });
}

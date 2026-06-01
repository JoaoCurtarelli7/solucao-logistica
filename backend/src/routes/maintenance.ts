import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middlewares/authMiddleware";

export async function maintenanceRoutes(app: FastifyInstance) {
  const paramsSchema = z.object({ id: z.coerce.number(), truckId: z.coerce.number() });
  const bodySchema = z.object({
    date: z.coerce.date(),
    service: z.string(),
    km: z.coerce.number(),
    value: z.coerce.number(),
    notes: z.string().optional(),
    truckId: z.coerce.number(),
  });

  app.addHook("preHandler", authMiddleware);

  // Listar manutenção de um caminhão
  app.get("/maintenance/:truckId", async (req: FastifyRequest, rep: FastifyReply) => {
    const { truckId } = paramsSchema.parse(req.params);
    const tenantId = req.user!.tenantId;
    try {
      const maintenances = await prisma.maintenance.findMany({
        where: { truckId, Truck: { tenantId } },
      });
      return maintenances;
    } catch (error) {
      console.error(error);
      return rep.code(500).send({ message: "Erro ao listar manutenções" });
    }
  });

  // Criar manutenção
  app.post("/maintenance", async (req: FastifyRequest, rep: FastifyReply) => {
    const data = bodySchema.parse(req.body);
    const tenantId = req.user!.tenantId;
    try {
      // Verify truck belongs to tenant
      const truck = await prisma.truck.findFirst({ where: { id: data.truckId, tenantId } });
      if (!truck) {
        return rep.code(404).send({ message: "Caminhão não encontrado" });
      }
      const maintenance = await prisma.maintenance.create({ data: { ...data, tenantId } });
      return rep.code(201).send(maintenance);
    } catch (error) {
      console.error(error);
      return rep.code(500).send({ message: "Erro ao criar manutenção" });
    }
  });

  // Atualizar manutenção
  app.put("/maintenance/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);
    const data = bodySchema.parse(req.body);
    const tenantId = req.user!.tenantId;

    try {
      // Verify maintenance's truck belongs to tenant
      const existingMaintenance = await prisma.maintenance.findFirst({
        where: { id, Truck: { tenantId } },
      });
      if (!existingMaintenance) {
        return rep.code(404).send({ message: "Manutenção não encontrada" });
      }
      const maintenance = await prisma.maintenance.update({ where: { id }, data });
      return rep.send(maintenance);
    } catch (error) {
      console.error(error);
      return rep.code(500).send({ message: "Erro ao atualizar manutenção" });
    }
  });

  // Deletar manutenção
  app.delete("/maintenance/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);
    const tenantId = req.user!.tenantId;
    try {
      // Verify maintenance's truck belongs to tenant
      const existingMaintenance = await prisma.maintenance.findFirst({
        where: { id, Truck: { tenantId } },
      });
      if (!existingMaintenance) {
        return rep.code(404).send({ message: "Manutenção não encontrada" });
      }
      await prisma.maintenance.delete({ where: { id } });
      return rep.code(204).send();
    } catch (error) {
      console.error(error);
      return rep.code(500).send({ message: "Erro ao deletar manutenção" });
    }
  });
}

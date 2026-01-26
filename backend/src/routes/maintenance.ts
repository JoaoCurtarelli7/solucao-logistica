import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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
    try {
      const maintenances = await prisma.maintenance.findMany({ where: { truckId } });
      return maintenances;
    } catch (error) {
      console.error(error);
      return rep.code(500).send({ message: "Erro ao listar manutenções" });
    }
  });

  // Criar manutenção
  app.post("/maintenance", async (req: FastifyRequest, rep: FastifyReply) => {
    const data = bodySchema.parse(req.body);
    try {
      const maintenance = await prisma.maintenance.create({ data });
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

    try {
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
    try {
      await prisma.maintenance.delete({ where: { id } });
      return rep.code(204).send();
    } catch (error) {
      console.error(error);
      return rep.code(500).send({ message: "Erro ao deletar manutenção" });
    }
  });
}

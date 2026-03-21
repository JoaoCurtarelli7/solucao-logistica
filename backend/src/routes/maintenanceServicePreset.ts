import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/permissionMiddleware";

function prismaCatalogErrorMessage(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return (
        "Tabela do catálogo não existe no banco. No diretório backend, execute: npx prisma migrate deploy && npx prisma generate e reinicie o servidor."
      );
    }
  }
  const msg = error instanceof Error ? error.message : String(error);
  if (/does not exist|relation .* does not exist|Unknown table/i.test(msg)) {
    return (
      "Tabela do catálogo não encontrada. No diretório backend: npx prisma migrate deploy && npx prisma generate"
    );
  }
  return null;
}

export async function maintenanceServicePresetRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Listar serviços do catálogo (padrão + salvos)
  app.get(
    "/maintenance-service-presets",
    { preHandler: requirePermission("maintenance.view") },
    async (_req: FastifyRequest, rep: FastifyReply) => {
      try {
        const presets = await prisma.maintenanceServicePreset.findMany({
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        });
        return rep.send(presets);
      } catch (error) {
        console.error("Erro ao listar serviços de manutenção:", error);
        const hint = prismaCatalogErrorMessage(error);
        return rep.code(500).send({
          message: hint ?? "Erro ao listar serviços",
        });
      }
    },
  );

  // Adicionar novo serviço ao catálogo (fica salvo para todos)
  app.post(
    "/maintenance-service-presets",
    { preHandler: requirePermission("maintenance.create") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const bodySchema = z.object({
          name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(200),
        });
        const { name } = bodySchema.parse(req.body);
        const trimmed = name.trim();

        const existing = await prisma.maintenanceServicePreset.findUnique({
          where: { name: trimmed },
        });
        if (existing) {
          return rep.send(existing);
        }

        const created = await prisma.maintenanceServicePreset.create({
          data: { name: trimmed, isDefault: false },
        });
        return rep.code(201).send(created);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return rep.code(400).send({
            message: "Dados inválidos",
            errors: error.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
          });
        }
        console.error("Erro ao criar serviço de manutenção:", error);
        const hint = prismaCatalogErrorMessage(error);
        return rep.code(500).send({ message: hint ?? "Erro ao salvar serviço" });
      }
    },
  );
}

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

  // Obter serviço por ID
  app.get(
    "/maintenance-service-presets/:id",
    { preHandler: requirePermission("maintenance.view") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
        const preset = await prisma.maintenanceServicePreset.findUnique({ where: { id } });
        if (!preset) return rep.code(404).send({ message: "Serviço não encontrado" });
        return rep.send(preset);
      } catch (error) {
        console.error("Erro ao buscar serviço:", error);
        const hint = prismaCatalogErrorMessage(error);
        return rep.code(500).send({ message: hint ?? "Erro ao buscar serviço" });
      }
    },
  );

  // Atualizar serviço
  app.put(
    "/maintenance-service-presets/:id",
    { preHandler: requirePermission("maintenance.update") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
        const bodySchema = z.object({
          name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(200),
        });
        const { name } = bodySchema.parse(req.body);
        const trimmed = name.trim();

        const existing = await prisma.maintenanceServicePreset.findFirst({
          where: { name: trimmed, id: { not: id } },
        });
        if (existing) {
          return rep.code(400).send({ message: "Já existe um serviço com este nome" });
        }

        const preset = await prisma.maintenanceServicePreset.findUnique({ where: { id } });
        if (!preset) return rep.code(404).send({ message: "Serviço não encontrado" });
        if (preset.isDefault) {
          return rep.code(400).send({ message: "Não é possível editar serviços padrão do sistema" });
        }

        const updated = await prisma.maintenanceServicePreset.update({
          where: { id },
          data: { name: trimmed },
        });
        return rep.send(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return rep.code(400).send({
            message: "Dados inválidos",
            errors: error.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
          });
        }
        console.error("Erro ao atualizar serviço:", error);
        const hint = prismaCatalogErrorMessage(error);
        return rep.code(500).send({ message: hint ?? "Erro ao atualizar serviço" });
      }
    },
  );

  // Deletar serviço
  app.delete(
    "/maintenance-service-presets/:id",
    { preHandler: requirePermission("maintenance.delete") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
        const preset = await prisma.maintenanceServicePreset.findUnique({ where: { id } });
        if (!preset) return rep.code(404).send({ message: "Serviço não encontrado" });
        if (preset.isDefault) {
          return rep.code(400).send({ message: "Não é possível deletar serviços padrão do sistema" });
        }
        await prisma.maintenanceServicePreset.delete({ where: { id } });
        return rep.send({ message: "Serviço deletado com sucesso" });
      } catch (error) {
        console.error("Erro ao deletar serviço:", error);
        const hint = prismaCatalogErrorMessage(error);
        return rep.code(500).send({ message: hint ?? "Erro ao deletar serviço" });
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

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middlewares/authMiddleware";

export async function companyRoutes(app: FastifyInstance) {
  const paramsSchema = z.object({
    id: z.coerce.number(),
  });

  const bodySchema = z.object({
    name: z.string(),
    type: z.string(),
    cnpj: z.string(),
    dateRegistration: z.coerce.date(),
    status: z.enum(["Ativo", "Inativo"]),
    responsible: z.string(),
    commission: z.coerce.number(),
  });

  // Listar todas as empresas (rota pública para permitir seleção)
  app.get("/companies", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const companies = await prisma.company.findMany({
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
    } catch (error: any) {
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
  app.addHook("preHandler", authMiddleware);

  // Obter uma empresa pelo ID
  app.get("/company/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);

      const company = await prisma.company.findUniqueOrThrow({
        where: { id },
      });

      return rep.send(company);
    } catch (error: any) {
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
  app.post("/company", async (req: FastifyRequest, rep: FastifyReply) => {
    const { name, type, cnpj, dateRegistration, status, responsible, commission } =
      bodySchema.parse(req.body);

    try {
      const company = await prisma.company.create({
        data: { name, type, cnpj, dateRegistration, status, responsible, commission },
      });

      return rep.code(201).send(company);
    } catch (error: any) {
      if (error.code === "P2002" && error.meta?.target?.includes("cnpj")) {
        return rep.code(400).send({ message: "Já existe uma empresa cadastrada com este CNPJ" });
      }
      console.error("Erro ao criar empresa:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar uma empresa existente
  app.put("/company/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);
    const { name, type, cnpj, dateRegistration, status, responsible, commission } =
      bodySchema.parse(req.body);

    try {
      await prisma.company.findUniqueOrThrow({ where: { id } });

      const updatedCompany = await prisma.company.update({
        where: { id },
        data: { name, type, cnpj, dateRegistration, status, responsible, commission },
      });

      return rep.send(updatedCompany);
    } catch (error: any) {
      if (error.code === "P2002" && error.meta?.target?.includes("cnpj")) {
        return rep.code(400).send({ message: "Já existe uma empresa cadastrada com este CNPJ" });
      }
      console.error("Erro ao atualizar empresa:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Deletar uma empresa
  app.delete("/company/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);

    try {
      const company = await prisma.company.delete({ where: { id } });
      return company;
    } catch (error) {
      console.error("Erro ao deletar empresa:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });
}

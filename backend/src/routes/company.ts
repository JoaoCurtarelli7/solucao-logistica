import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middlewares/authMiddleware";
import { paginationSchema, paginationMeta } from "../lib/paginate";

export async function companyRoutes(app: FastifyInstance) {
  const paramsSchema = z.object({ id: z.coerce.number() });

  const bodySchema = z.object({
    name: z.string(),
    type: z.string(),
    cnpj: z.string(),
    dateRegistration: z.coerce.date(),
    status: z.enum(["Ativo", "Inativo"]),
    responsible: z.string(),
    commission: z.coerce.number(),
  });

  app.addHook("preHandler", authMiddleware);

  // LISTAR — suporta ?page=&limit=&search=
  app.get("/companies", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const query = paginationSchema.parse(req.query);
      const hasPagination = !!(req.query as Record<string, unknown>).page;

      const where = {
        tenantId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" as const } },
                { cnpj: { contains: query.search } },
                { responsible: { contains: query.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const select = { id: true, name: true, type: true, cnpj: true, dateRegistration: true, status: true, responsible: true, commission: true };

      if (!hasPagination) {
        const companies = await prisma.company.findMany({ where, select, orderBy: { name: "asc" } });
        return rep.send(companies);
      }

      const [total, companies] = await prisma.$transaction([
        prisma.company.count({ where }),
        prisma.company.findMany({
          where, select, orderBy: { name: "asc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
      ]);
      return rep.send({ data: companies, ...paginationMeta(total, query.page, query.limit) });
    } catch (error: any) {
      return rep.code(500).send({ message: "Erro ao buscar empresas" });
    }
  });

  app.get("/company/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const tenantId = req.user!.tenantId;
      const company = await prisma.company.findFirst({ where: { id, tenantId } });
      if (!company) return rep.code(404).send({ message: "Empresa não encontrada" });
      return rep.send(company);
    } catch (error: any) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.post("/company", async (req: FastifyRequest, rep: FastifyReply) => {
    const { name, type, cnpj, dateRegistration, status, responsible, commission } = bodySchema.parse(req.body);
    const tenantId = req.user!.tenantId;
    try {
      const company = await prisma.company.create({
        data: { name, type, cnpj, dateRegistration, status, responsible, commission, tenantId },
      });
      return rep.code(201).send(company);
    } catch (error: any) {
      if (error.code === "P2002") {
        return rep.code(400).send({ message: "Já existe uma empresa cadastrada com este CNPJ" });
      }
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.put("/company/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);
    const { name, type, cnpj, dateRegistration, status, responsible, commission } = bodySchema.parse(req.body);
    const tenantId = req.user!.tenantId;
    try {
      const existing = await prisma.company.findFirst({ where: { id, tenantId } });
      if (!existing) return rep.code(404).send({ message: "Empresa não encontrada" });

      const updatedCompany = await prisma.company.update({
        where: { id },
        data: { name, type, cnpj, dateRegistration, status, responsible, commission },
      });
      return rep.send(updatedCompany);
    } catch (error: any) {
      if (error.code === "P2002") {
        return rep.code(400).send({ message: "Já existe uma empresa cadastrada com este CNPJ" });
      }
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.delete("/company/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);
    const tenantId = req.user!.tenantId;
    try {
      const existing = await prisma.company.findFirst({ where: { id, tenantId } });
      if (!existing) return rep.code(404).send({ message: "Empresa não encontrada" });
      await prisma.company.delete({ where: { id } });
      return rep.send({ message: "Empresa deletada com sucesso" });
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });
}

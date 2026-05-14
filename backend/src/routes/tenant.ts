import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { authMiddleware } from "../middlewares/authMiddleware";
import { hashPassword } from "../lib/auth";

function requireSuperAdmin(req: FastifyRequest, rep: FastifyReply, done: () => void) {
  if (!req.user?.isSuperAdmin) {
    return rep.code(403).send({ message: "Acesso restrito a super administradores" });
  }
  done();
}

export async function tenantRoutes(app: FastifyInstance) {

  // ---- Rota pública: solicitar acesso (sem autenticação) ----
  app.post("/public/register", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const schema = z.object({
        name: z.string().min(2, "Nome é obrigatório"),
        email: z.string().email("E-mail inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
        tenantName: z.string().min(2, "Nome da empresa é obrigatório"),
        cnpj: z.string().optional().nullable(),
      });
      const { name, email, password, tenantName, cnpj } = schema.parse(req.body);

      const emailTaken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (emailTaken) return rep.code(400).send({ message: "E-mail já está em uso" });

      const tenant = await prisma.tenant.create({
        data: { name: tenantName, cnpj: cnpj ?? null, status: "pending" },
      });

      let adminRole = await prisma.role.findFirst({ where: { name: "Admin" } });
      if (!adminRole) {
        adminRole = await prisma.role.create({ data: { name: "Admin", description: "Acesso total ao sistema" } });
      }

      const hashed = await hashPassword(password);
      await prisma.user.create({
        data: {
          name,
          email,
          password: hashed,
          status: "inactive",
          tenantId: tenant.id,
          isSuperAdmin: false,
          roleId: adminRole.id,
        },
      });

      return rep.code(201).send({
        message: "Solicitação enviada com sucesso. Aguarde a aprovação do administrador.",
        tenantId: tenant.id,
      });
    } catch (error: any) {
      if (error.name === "ZodError") return rep.code(400).send({ message: "Dados inválidos", errors: error.errors });
      if (error.code === "P2002") return rep.code(400).send({ message: "E-mail ou CNPJ já cadastrado" });
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.addHook("preHandler", authMiddleware);

  const bodySchema = z.object({
    name: z.string().min(2, "Nome é obrigatório"),
    cnpj: z.string().optional().nullable(),
    status: z.enum(["active", "inactive"]).default("active"),
  });

  const paramsSchema = z.object({ id: z.coerce.number() });

  // Listar todos os tenants (super admin only)
  app.get("/tenants", { preHandler: requireSuperAdmin }, async (_req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { User: true, Employee: true, Company: true } },
        },
      });
      return rep.send(tenants);
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Buscar tenant por ID (super admin only)
  app.get("/tenants/:id", { preHandler: requireSuperAdmin }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: {
          _count: { select: { User: true, Employee: true, Company: true, Truck: true } },
        },
      });
      if (!tenant) return rep.code(404).send({ message: "Tenant não encontrado" });
      return rep.send(tenant);
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Criar tenant (super admin only)
  app.post("/tenants", { preHandler: requireSuperAdmin }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const data = bodySchema.parse(req.body);
      const tenant = await prisma.tenant.create({
        data: { name: data.name, cnpj: data.cnpj ?? null, status: data.status },
      });
      return rep.code(201).send(tenant);
    } catch (error: any) {
      if (error.code === "P2002") {
        return rep.code(400).send({ message: "CNPJ já cadastrado" });
      }
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar tenant (super admin only)
  app.put("/tenants/:id", { preHandler: requireSuperAdmin }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const data = bodySchema.parse(req.body);
      const tenant = await prisma.tenant.update({
        where: { id },
        data: { name: data.name, cnpj: data.cnpj ?? null, status: data.status, updatedAt: new Date() },
      });
      return rep.send(tenant);
    } catch (error: any) {
      if (error.code === "P2025") return rep.code(404).send({ message: "Tenant não encontrado" });
      if (error.code === "P2002") return rep.code(400).send({ message: "CNPJ já cadastrado" });
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Criar admin para um tenant (super admin only)
  app.post("/tenants/:id/users", { preHandler: requireSuperAdmin }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id: tenantId } = paramsSchema.parse(req.params);
      const schema = z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
      });
      const { name, email, password } = schema.parse(req.body);

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return rep.code(404).send({ message: "Tenant não encontrado" });

      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) return rep.code(400).send({ message: "E-mail já está em uso" });

      // Garantir que role Admin existe
      let adminRole = await prisma.role.findFirst({ where: { name: "Admin" } });
      if (!adminRole) {
        adminRole = await prisma.role.create({ data: { name: "Admin", description: "Acesso total ao sistema" } });
      }

      const hashed = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashed,
          status: "active",
          tenantId,
          isSuperAdmin: false,
          roleId: adminRole.id,
        },
        select: { id: true, name: true, email: true, status: true, tenantId: true, createdAt: true },
      });

      return rep.code(201).send({ user, tenantName: tenant.name });
    } catch (error: any) {
      if (error.name === "ZodError") return rep.code(400).send({ message: "Dados inválidos", errors: error.errors });
      if (error.code === "P2002") return rep.code(400).send({ message: "E-mail já está em uso" });
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Listar usuários de um tenant (super admin only)
  app.get("/tenants/:id/users", { preHandler: requireSuperAdmin }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id: tenantId } = paramsSchema.parse(req.params);
      const users = await prisma.user.findMany({
        where: { tenantId },
        select: { id: true, name: true, email: true, status: true, isSuperAdmin: true, createdAt: true, role: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return rep.send(users);
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Aprovar tenant (super admin only)
  app.patch("/tenants/:id/approve", { preHandler: requireSuperAdmin }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const tenant = await prisma.tenant.findUnique({ where: { id } });
      if (!tenant) return rep.code(404).send({ message: "Tenant não encontrado" });

      await prisma.tenant.update({ where: { id }, data: { status: "active", updatedAt: new Date() } });
      await prisma.user.updateMany({ where: { tenantId: id, status: "inactive" }, data: { status: "active" } });

      return rep.send({ message: "Tenant aprovado com sucesso" });
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Rejeitar tenant (super admin only)
  app.patch("/tenants/:id/reject", { preHandler: requireSuperAdmin }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const tenant = await prisma.tenant.findUnique({ where: { id } });
      if (!tenant) return rep.code(404).send({ message: "Tenant não encontrado" });

      await prisma.tenant.update({ where: { id }, data: { status: "rejected", updatedAt: new Date() } });

      return rep.send({ message: "Tenant rejeitado" });
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Desativar/reativar tenant (super admin only)
  app.patch("/tenants/:id/status", { preHandler: requireSuperAdmin }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const { status } = z.object({ status: z.enum(["active", "inactive"]) }).parse(req.body);

      const tenant = await prisma.tenant.findUnique({ where: { id } });
      if (!tenant) return rep.code(404).send({ message: "Tenant não encontrado" });

      await prisma.tenant.update({ where: { id }, data: { status, updatedAt: new Date() } });

      return rep.send({ message: `Tenant ${status === "active" ? "ativado" : "desativado"} com sucesso` });
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });
}

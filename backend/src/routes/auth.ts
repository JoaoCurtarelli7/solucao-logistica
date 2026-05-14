import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { generateToken, hashPassword } from "../lib/auth";
import bcrypt from "bcrypt";

const BOOTSTRAP_ADMIN_PERMISSIONS = [
  "dashboard.view",
  "users.view", "users.create", "users.update", "users.delete", "users.manage",
  "roles.view", "roles.create", "roles.update", "roles.delete",
  "permissions.view", "permissions.create", "permissions.update", "permissions.delete",
  "companies.view", "companies.create", "companies.update", "companies.delete",
  "employees.view", "employees.create", "employees.update", "employees.delete",
  "trucks.view", "trucks.create", "trucks.update", "trucks.delete",
  "trips.view", "trips.create", "trips.update", "trips.delete",
  "tripExpenses.view", "tripExpenses.create", "tripExpenses.update", "tripExpenses.delete",
  "maintenance.view", "maintenance.create", "maintenance.update", "maintenance.delete",
  "loads.view", "loads.create", "loads.update", "loads.delete",
  "financial.view", "financial.create", "financial.update", "financial.delete",
  "closings.view", "closings.create", "closings.update", "closings.delete",
  "months.view", "months.create", "months.update", "months.delete",
  "reports.view", "reports.export",
  "tenants.manage",
];

async function ensureAdminRoleExists(): Promise<{ id: number }> {
  await prisma.$transaction(
    BOOTSTRAP_ADMIN_PERMISSIONS.map((key) =>
      prisma.permission.upsert({ where: { key }, create: { key }, update: {} }),
    ),
  );

  let adminRole = await prisma.role.findFirst({ where: { name: "Admin" } });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: { name: "Admin", description: "Acesso total ao sistema" },
    });
  }

  const perms = await prisma.permission.findMany({
    where: { key: { in: BOOTSTRAP_ADMIN_PERMISSIONS } },
    select: { id: true },
  });
  if (perms.length) {
    await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: adminRole!.id, permissionId: p.id })),
    });
  }
  return { id: adminRole.id };
}

async function ensureUserRoleExists(): Promise<{ id: number }> {
  let userRole = await prisma.role.findFirst({ where: { name: "User" } });
  if (userRole) return { id: userRole.id };
  userRole = await prisma.role.create({
    data: { name: "User", description: "Usuário padrão do sistema" },
  });
  const perms = await prisma.permission.findMany({
    where: { key: { in: ["dashboard.view"] } },
    select: { id: true },
  });
  if (perms.length) {
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: userRole!.id, permissionId: p.id })),
    });
  }
  return { id: userRole.id };
}

export async function authRoutes(app: FastifyInstance) {
  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
  });

  app.get("/auth/bootstrap-status", async (_req: FastifyRequest, rep: FastifyReply) => {
    const count = await prisma.user.count();
    return rep.send({ firstUserSetup: count === 0 });
  });

  // Cadastro público: apenas quando não existe nenhum usuário (bootstrap do primeiro admin)
  app.post("/register", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const bodySchema = z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
        tenantName: z.string().min(1, "Nome da empresa é obrigatório"),
      });

      const { name, email, password, tenantName } = bodySchema.parse(req.body);

      const userCount = await prisma.user.count();
      if (userCount > 0) {
        return rep.code(403).send({
          message: "Cadastro público desativado. Peça a um administrador para criar sua conta.",
        });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return rep.code(400).send({ message: "E-mail já está em uso" });
      }

      await ensureAdminRoleExists();
      await ensureUserRoleExists();
      const adminRole = await prisma.role.findFirst({ where: { name: "Admin" } });
      if (!adminRole) {
        return rep.code(500).send({ message: "Perfil Admin não encontrado após bootstrap" });
      }

      // Criar o tenant principal junto com o primeiro admin
      const tenant = await prisma.tenant.create({
        data: { name: tenantName, status: "active" },
      });

      const hashedPassword = await hashPassword(password);
      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          roleId: adminRole.id,
          status: "active",
          tenantId: tenant.id,
          isSuperAdmin: true,
        },
      });

      console.log("✅ Primeiro administrador criado:", { id: newUser.id, email: newUser.email, tenant: tenant.name });

      return rep.code(201).send({
        message: "Primeiro administrador criado. Você pode fazer login.",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: "Admin",
          tenantId: tenant.id,
          tenantName: tenant.name,
        },
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return rep.code(400).send({ message: "Dados inválidos", errors: error.errors });
      }
      if (error.code === "P2002") {
        return rep.code(400).send({ message: "E-mail já está em uso" });
      }
      console.error("❌ Erro ao registrar:", error);
      return rep.code(500).send({ message: "Erro ao criar usuário" });
    }
  });

  app.post("/login", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          Tenant: { select: { id: true, name: true, status: true } },
          role: {
            include: {
              permissions: { include: { permission: { select: { key: true } } } },
            },
          },
        },
      });

      if (!user) {
        return rep.code(401).send({ message: "Email ou senha inválidos" });
      }

      if (user.status && user.status !== "active") {
        return rep.code(403).send({ message: "Usuário inativo" });
      }

      if (user.Tenant?.status && user.Tenant.status !== "active") {
        return rep.code(403).send({ message: "Acesso suspenso. Entre em contato com o suporte." });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return rep.code(401).send({ message: "Email ou senha inválidos" });
      }

      const permissions: string[] =
        user.role?.permissions?.map((rp: any) => rp.permission?.key).filter(Boolean) ?? [];

      const token = generateToken({
        userId: user.id,
        tenantId: user.tenantId,
        isSuperAdmin: user.isSuperAdmin,
        roleId: user.role?.id ?? null,
        role: user.role?.name ?? null,
        permissions,
      });

      return rep.send({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          tenantId: user.tenantId,
          tenantName: user.Tenant?.name ?? null,
          isSuperAdmin: user.isSuperAdmin,
          role: user.role?.name ?? null,
          permissions,
        },
      });
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return rep.code(400).send({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("❌ Erro no login:", error);
      return rep.code(500).send({ message: "Erro no servidor ao fazer login" });
    }
  });
}

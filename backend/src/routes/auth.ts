import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { generateToken, hashPassword, generateResetToken, verifyResetToken } from "../lib/auth";
import { sendPasswordResetEmail } from "../services/emailService";
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

  // Renova o token sem precisar fazer login novamente
  app.post("/auth/refresh", async (req: FastifyRequest, rep: FastifyReply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return rep.code(401).send({ message: "Token não fornecido" });
    }
    const token = authHeader.slice(7);
    try {
      const jwt = await import("jsonwebtoken");
      const secret = process.env.JWT_SECRET || "supersecret";
      // Aceita tokens até 1h após expirar para refresh
      const decoded = jwt.default.verify(token, secret, { ignoreExpiration: true }) as any;
      const iat = decoded.iat as number;
      const now = Math.floor(Date.now() / 1000);
      // Só aceita refresh se o token foi emitido há menos de 24h
      if (now - iat > 86400) {
        return rep.code(401).send({ message: "Token muito antigo. Faça login novamente." });
      }
      const { iat: _i, exp: _e, ...payload } = decoded;
      const newToken = generateToken(payload);
      return rep.send({ token: newToken });
    } catch {
      return rep.code(401).send({ message: "Token inválido" });
    }
  });

  // Solicita reset de senha — envia e-mail com link
  app.post("/auth/forgot-password", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, status: true } });

      // Sempre responde 200 para não vazar se e-mail existe
      if (!user || user.status !== "active") {
        return rep.send({ message: "Se o e-mail estiver cadastrado, você receberá o link em breve." });
      }

      const resetToken = generateResetToken(user.id);
      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

      sendPasswordResetEmail(user.email, user.name, resetUrl).catch((err) =>
        console.error("[email] Erro ao enviar reset:", err.message),
      );

      return rep.send({ message: "Se o e-mail estiver cadastrado, você receberá o link em breve." });
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return rep.code(400).send({ message: "E-mail inválido" });
      }
      console.error("❌ Erro no forgot-password:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Redefine a senha usando o token do e-mail
  app.post("/auth/reset-password", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { token, password } = z.object({
        token: z.string().min(1),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      }).parse(req.body);

      let decoded: { userId: number; purpose: string };
      try {
        decoded = verifyResetToken(token);
      } catch {
        return rep.code(400).send({ message: "Link de redefinição inválido ou expirado." });
      }

      if (decoded.purpose !== "password-reset") {
        return rep.code(400).send({ message: "Token inválido." });
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, status: true } });
      if (!user || user.status !== "active") {
        return rep.code(404).send({ message: "Usuário não encontrado ou inativo." });
      }

      const hashed = await hashPassword(password);
      await prisma.user.update({ where: { id: decoded.userId }, data: { password: hashed } });

      return rep.send({ message: "Senha redefinida com sucesso. Você já pode fazer login." });
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return rep.code(400).send({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("❌ Erro no reset-password:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req: FastifyRequest, rep: FastifyReply) => {
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

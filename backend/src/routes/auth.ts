import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "../types/fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { generateToken, hashPassword } from "../lib/auth";
import bcrypt from "bcrypt";

// Permissões mínimas para o primeiro usuário (Admin) quando não há seed
const BOOTSTRAP_ADMIN_PERMISSIONS = [
  "dashboard.view",
  "users.view",
  "users.create",
  "users.update",
  "users.delete",
  "users.manage",
  "roles.view",
  "roles.create",
  "roles.update",
  "roles.delete",
  "permissions.view",
  "companies.view",
  "employees.view",
  "trucks.view",
  "trips.view",
  "loads.view",
  "financial.view",
  "closings.view",
  "months.view",
  "reports.view",
  "reports.export",
];

async function ensureAdminRoleExists(): Promise<{ id: number }> {
  let adminRole = await prisma.role.findFirst({ where: { name: "Admin" } });
  if (adminRole) return { id: adminRole.id };
  await prisma.permission.createMany({
    data: BOOTSTRAP_ADMIN_PERMISSIONS.map((key) => ({ key })),
    skipDuplicates: true,
  });
  adminRole = await prisma.role.create({
    data: { name: "Admin", description: "Acesso total ao sistema" },
  });
  const perms = await prisma.permission.findMany({
    where: { key: { in: BOOTSTRAP_ADMIN_PERMISSIONS } },
    select: { id: true },
  });
  if (perms.length) {
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: adminRole!.id, permissionId: p.id })),
      skipDuplicates: true,
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
      skipDuplicates: true,
    });
  }
  return { id: userRole.id };
}

export async function authRoutes(app: FastifyInstance) {
  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
  });

  app.post("/register", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const bodySchema = z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      });

      const { name, email, password } = bodySchema.parse(req.body);

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return rep.code(400).send({ message: "E-mail já está em uso" });
      }

      const userCount = await prisma.user.count();
      const isFirstUser = userCount === 0;

      const roleToAssign = isFirstUser
        ? await ensureAdminRoleExists()
        : await ensureUserRoleExists();

      const hashedPassword = await hashPassword(password);

      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          roleId: roleToAssign.id,
          status: "active",
        },
      });

      if (isFirstUser) {
        console.log("✅ Primeiro usuário do sistema criado como Admin:", {
          id: newUser.id,
          email: newUser.email,
        });
      } else {
        console.log("✅ Usuário criado com sucesso:", {
          id: newUser.id,
          email: newUser.email,
        });
      }

      return rep.code(201).send({
        message: isFirstUser
          ? "Cadastro realizado! Você é o primeiro usuário e recebeu o perfil Admin."
          : "Usuário criado com sucesso!",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: isFirstUser ? "Admin" : "User",
        },
      });
    } catch (error: any) {
      console.error("❌ Erro ao registrar usuário:", error);
      console.error("Detalhes:", {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
        stack: error?.stack,
      });

      // Erros de validação (Zod)
      if (error.name === "ZodError") {
        return rep.code(400).send({
          message: "Dados inválidos",
          errors: error.errors,
        });
      }

      // Erro de violação de unicidade (email duplicado)
      if (error.code === "P2002") {
        return rep.code(400).send({
          message: "E-mail já está em uso",
          field: error.meta?.target?.[0] || "email",
        });
      }

      // Erro genérico
      return rep.code(500).send({
        message: "Erro ao criar usuário",
        error:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      });
    }
  });

  app.post("/login", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      let user: any = null;
      try {
        user = await prisma.user.findUnique({
          where: { email },
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: {
                      select: { key: true },
                    },
                  },
                },
              },
            },
          },
        });
      } catch (includeError: any) {
        app.log.warn(
          "Login: include role/permissions falhou, buscando só usuário:",
          includeError?.message,
        );
        user = await prisma.user.findUnique({
          where: { email },
        });
      }

      if (!user) {
        return rep.code(401).send({ message: "Email ou senha inválidos" });
      }

      if (user.status && user.status !== "active") {
        return rep.code(403).send({ message: "Usuário inativo" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return rep.code(401).send({ message: "Email ou senha inválidos" });
      }

      const permissions: string[] =
        user.role?.permissions
          ?.map((rp: { permission?: { key?: string } }) => rp.permission?.key)
          .filter(Boolean) ?? [];
      const token = generateToken({
        userId: user.id,
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
          role: user.role?.name ?? null,
          permissions,
        },
      });
    } catch (error: any) {
      console.error("❌ Erro no login:", error);
      console.error("Detalhes:", {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
        stack: error?.stack,
      });

      if (error?.name === "ZodError") {
        return rep.code(400).send({
          message: "Dados inválidos",
          errors: error.errors,
        });
      }

      return rep.code(500).send({
        message: "Erro no servidor ao fazer login",
        error: error?.message ?? undefined,
      });
    }
  });
}

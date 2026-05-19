import "./instrument";
import console from "console";
import app from "./app";
import { prisma } from "./lib/prisma";
import { hashPassword } from "./lib/auth";

function validateEnvironment() {
  const jwtSecret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (!jwtSecret || jwtSecret.length < 32) {
    if (isProd) {
      console.error("[FATAL] JWT_SECRET deve ter no mínimo 32 caracteres em produção. Encerrando.");
      process.exit(1);
    } else {
      console.warn("[SECURITY] JWT_SECRET fraco ou ausente. Configure antes de ir para produção.");
    }
  }

  if (isProd && process.env.CORS_ORIGIN === "*") {
    console.error("[FATAL] CORS_ORIGIN=* não é permitido em produção. Defina origens específicas.");
    process.exit(1);
  }
}

async function ensureOwner() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME || "Super Admin";
  if (!email || !password) return;

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    // Produção: cria super admin do zero
    let adminRole = await prisma.role.findFirst({ where: { name: "Admin" } });
    if (!adminRole) {
      adminRole = await prisma.role.create({ data: { name: "Admin", description: "Acesso total ao sistema" } });
    }

    const tenant = await prisma.tenant.create({
      data: { name: "Super Admin", status: "active" },
    });

    const hashed = await hashPassword(password);
    await prisma.user.create({
      data: { name, email, password: hashed, status: "active", isSuperAdmin: true, tenantId: tenant.id, roleId: adminRole.id },
    });

    console.log(`[owner] Super admin criado: ${email}`);
    return;
  }

  // Garante flags corretas + atualiza senha se OWNER_PASSWORD definido
  const hashed = await hashPassword(password);
  await prisma.user.update({
    where: { id: existing.id },
    data: { isSuperAdmin: true, status: "active", password: hashed },
  });

  if (existing.tenantId) {
    await prisma.tenant.update({ where: { id: existing.tenantId }, data: { status: "active" } });
  }

  console.log(`[owner] ${email} garantido como superAdmin ativo.`);
}

const initializeServer = async () => {
  validateEnvironment();
  await ensureOwner();

  const port = Number(process.env.PORT) || 3333;
  await app.listen({ host: "0.0.0.0", port }).catch((err: any) => {
    console.error("Erro ao iniciar servidor:", err);
    process.exit(1);
  });
};

const gracefulShutdown = async (signal: string) => {
  console.log(`[shutdown] ${signal} recebido, encerrando graciosamente...`);
  try {
    await app.close();
    await prisma.$disconnect();
    console.log("[shutdown] Servidor encerrado com sucesso.");
    process.exit(0);
  } catch (err) {
    console.error("[shutdown] Erro ao encerrar:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

initializeServer();

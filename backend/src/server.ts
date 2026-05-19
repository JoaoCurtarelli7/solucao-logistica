import "./instrument";
import console from "console";
import app from "./app";
import { prisma } from "./lib/prisma";

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
  if (!email) return;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.warn(`[owner] OWNER_EMAIL=${email} não encontrado no banco. Crie o usuário primeiro.`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isSuperAdmin: true, status: "active" },
  });

  if (user.tenantId) {
    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: { status: "active" },
    });
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

import console from "console";
import app from "./app";
import { prisma } from "./lib/prisma";

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
  await ensureOwner();

  const port = Number(process.env.PORT) || 3333;
  await app.listen({
    host: "0.0.0.0",
    port: port,
  }).catch((err: any) => {
    console.error("Erro ao iniciar servidor:", err);
    process.exit(1);
  });
};

initializeServer();

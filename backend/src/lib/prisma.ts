import { PrismaClient } from "@prisma/client";

// Configuração do Prisma Client com tratamento de erros melhorado
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ["query", "error", "warn"] : ["error"],
  errorFormat: 'pretty',
});

// Testar conexão ao inicializar (em produção falha o processo para o deploy mostrar o erro)
prisma.$connect()
  .then(() => {
    console.log("✅ Prisma Client conectado ao PostgreSQL");
  })
  .catch((error) => {
    console.error("❌ Erro ao conectar Prisma Client:", error.message);
    console.error("   Verifique se o PostgreSQL está rodando e a DATABASE_URL está correta");
    process.exit(1);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
});

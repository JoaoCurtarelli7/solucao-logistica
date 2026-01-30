"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Configuração do Prisma Client com tratamento de erros melhorado
exports.prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ["query", "error", "warn"] : ["error"],
    errorFormat: 'pretty',
});
// Testar conexão ao inicializar (em produção falha o processo para o deploy mostrar o erro)
exports.prisma.$connect()
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
    await exports.prisma.$disconnect();
});
process.on('SIGINT', async () => {
    await exports.prisma.$disconnect();
});
process.on('SIGTERM', async () => {
    await exports.prisma.$disconnect();
});

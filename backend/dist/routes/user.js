"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = userRoutes;
const prisma_1 = require("../lib/prisma");
const bcrypt_1 = __importDefault(require("bcrypt"));
const zod_1 = require("zod");
const authMiddleware_1 = require("../middlewares/authMiddleware");
async function userRoutes(app) {
    // Aplicar autenticação em todas as rotas
    app.addHook('preHandler', authMiddleware_1.authMiddleware);
    // Obter dados do usuário logado
    app.get('/me', async (request, reply) => {
        try {
            if (!request.user) {
                return reply.code(401).send({ message: 'Usuário não autenticado' });
            }
            const userId = request.user.id;
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    address: true,
                    status: true,
                    role: {
                        select: {
                            id: true,
                            name: true,
                            permissions: {
                                select: {
                                    permission: { select: { key: true } },
                                },
                            },
                        },
                    },
                    createdAt: true,
                }
            });
            if (!user) {
                return reply.code(404).send({ message: 'Usuário não encontrado' });
            }
            const permissions = user.role?.permissions?.map((rp) => rp.permission.key) ?? [];
            return reply.send({
                ...user,
                role: user.role ? { id: user.role.id, name: user.role.name } : null,
                permissions,
            });
        }
        catch (error) {
            console.error('Erro ao buscar usuário:', error);
            return reply.code(500).send({ message: 'Erro interno do servidor' });
        }
    });
    // Editar dados do perfil do usuário logado
    app.put('/me', async (request, reply) => {
        const updateUserSchema = zod_1.z.object({
            name: zod_1.z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
            email: zod_1.z.string().email('Email inválido'),
            phone: zod_1.z.string().optional(),
            address: zod_1.z.string().optional()
        });
        try {
            if (!request.user) {
                return reply.code(401).send({ message: 'Usuário não autenticado' });
            }
            const userId = request.user.id;
            const data = updateUserSchema.parse(request.body);
            // Verificar se o email já está em uso por outro usuário
            if (data.email) {
                const existingUser = await prisma_1.prisma.user.findFirst({
                    where: {
                        email: data.email,
                        id: { not: userId }
                    }
                });
                if (existingUser) {
                    return reply.code(400).send({ message: 'Este email já está em uso por outro usuário' });
                }
            }
            const updatedUser = await prisma_1.prisma.user.update({
                where: { id: userId },
                data: {
                    name: data.name,
                    email: data.email,
                    phone: data.phone || null,
                    address: data.address || null
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    address: true,
                    createdAt: true
                }
            });
            return reply.send({
                message: 'Perfil atualizado com sucesso!',
                user: updatedUser
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    message: 'Dados inválidos',
                    errors: error.errors
                });
            }
            console.error('Erro ao atualizar usuário:', error);
            return reply.code(500).send({ message: 'Erro interno do servidor' });
        }
    });
    // Alterar senha do usuário logado
    app.patch('/me/password', async (request, reply) => {
        const changePasswordSchema = zod_1.z.object({
            currentPassword: zod_1.z.string().min(1, 'Senha atual é obrigatória'),
            newPassword: zod_1.z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres')
        });
        try {
            if (!request.user) {
                return reply.code(401).send({ message: 'Usuário não autenticado' });
            }
            const userId = request.user.id;
            const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);
            // Buscar usuário com senha para verificação
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                return reply.code(404).send({ message: 'Usuário não encontrado' });
            }
            // Verificar senha atual
            const passwordMatch = await bcrypt_1.default.compare(currentPassword, user.password);
            if (!passwordMatch) {
                return reply.code(401).send({ message: 'Senha atual incorreta' });
            }
            // Verificar se a nova senha é diferente da atual
            const newPasswordMatch = await bcrypt_1.default.compare(newPassword, user.password);
            if (newPasswordMatch) {
                return reply.code(400).send({ message: 'A nova senha deve ser diferente da senha atual' });
            }
            // Criptografar nova senha
            const hashedNewPassword = await bcrypt_1.default.hash(newPassword, 10);
            // Atualizar senha
            await prisma_1.prisma.user.update({
                where: { id: userId },
                data: { password: hashedNewPassword }
            });
            return reply.send({ message: 'Senha alterada com sucesso!' });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    message: 'Dados inválidos',
                    errors: error.errors
                });
            }
            console.error('Erro ao alterar senha:', error);
            return reply.code(500).send({ message: 'Erro interno do servidor' });
        }
    });
    // Obter estatísticas do usuário (opcional)
    app.get('/me/stats', async (request, reply) => {
        try {
            if (!request.user) {
                return reply.code(401).send({ message: 'Usuário não autenticado' });
            }
            const userId = request.user.id;
            // Aqui você pode adicionar estatísticas específicas do usuário
            // Por exemplo: número de ações realizadas, última atividade, etc.
            const stats = {
                lastLogin: new Date().toISOString(),
                profileUpdated: true,
                // Adicione mais estatísticas conforme necessário
            };
            return reply.send(stats);
        }
        catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            return reply.code(500).send({ message: 'Erro interno do servidor' });
        }
    });
}

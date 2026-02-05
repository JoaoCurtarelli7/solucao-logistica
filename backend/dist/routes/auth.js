"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const prisma_1 = require("../lib/prisma");
const zod_1 = require("zod");
const auth_1 = require("../lib/auth");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function authRoutes(app) {
    const loginSchema = zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string(),
    });
    app.post("/register", async (req, rep) => {
        try {
            const bodySchema = zod_1.z.object({
                name: zod_1.z.string().min(1, "Nome é obrigatório"),
                email: zod_1.z.string().email("Email inválido"),
                password: zod_1.z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
            });
            const { name, email, password } = bodySchema.parse(req.body);
            // Verificar se o usuário já existe
            const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return rep.code(400).send({ message: "E-mail já está em uso" });
            }
            // Buscar ou criar role padrão "User"
            let defaultRole = await prisma_1.prisma.role.findFirst({
                where: { name: "User" },
            });
            if (!defaultRole) {
                // Se não existir, criar role padrão "User"
                defaultRole = await prisma_1.prisma.role.create({
                    data: {
                        name: "User",
                        description: "Usuário padrão do sistema",
                    },
                });
            }
            // Hash da senha
            const hashedPassword = await (0, auth_1.hashPassword)(password);
            // Criar usuário com role padrão
            const newUser = await prisma_1.prisma.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    roleId: defaultRole.id,
                    status: "active",
                },
            });
            console.log("✅ Usuário criado com sucesso:", {
                id: newUser.id,
                email: newUser.email,
            });
            return rep.code(201).send({
                message: "Usuário criado com sucesso!",
                user: {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                },
            });
        }
        catch (error) {
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
                error: process.env.NODE_ENV === "development" ? error?.message : undefined,
            });
        }
    });
    app.post("/login", async (req, rep) => {
        try {
            const { email, password } = loginSchema.parse(req.body);
            const user = await prisma_1.prisma.user.findUnique({
                where: { email },
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: {
                                        select: {
                                            key: true,
                                        },
                                    },
                                },
                            },
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
            const isPasswordValid = await bcrypt_1.default.compare(password, user.password);
            if (!isPasswordValid) {
                return rep.code(401).send({ message: "Email ou senha inválidos" });
            }
            const permissions = user.role?.permissions?.map((rp) => rp.permission.key) ?? [];
            const token = (0, auth_1.generateToken)({
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
        }
        catch (error) {
            console.error("❌ Erro no login:", error);
            console.error("Detalhes:", {
                message: error?.message,
                code: error?.code,
                stack: error?.stack,
            });
            // Erros de validação (Zod)
            if (error.name === "ZodError") {
                return rep.code(400).send({
                    message: "Dados inválidos",
                    errors: error.errors,
                });
            }
            return rep.code(500).send({
                message: "Erro no servidor",
                error: process.env.NODE_ENV === "development" ? error?.message : undefined,
            });
        }
    });
}

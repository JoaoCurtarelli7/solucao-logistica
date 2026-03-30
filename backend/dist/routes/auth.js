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
// Permissões completas do perfil Admin (view + create + update + delete em todos os módulos)
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
    "permissions.create",
    "permissions.update",
    "permissions.delete",
    "companies.view",
    "companies.create",
    "companies.update",
    "companies.delete",
    "employees.view",
    "employees.create",
    "employees.update",
    "employees.delete",
    "trucks.view",
    "trucks.create",
    "trucks.update",
    "trucks.delete",
    "trips.view",
    "trips.create",
    "trips.update",
    "trips.delete",
    "tripExpenses.view",
    "tripExpenses.create",
    "tripExpenses.update",
    "tripExpenses.delete",
    "maintenance.view",
    "maintenance.create",
    "maintenance.update",
    "maintenance.delete",
    "loads.view",
    "loads.create",
    "loads.update",
    "loads.delete",
    "financial.view",
    "financial.create",
    "financial.update",
    "financial.delete",
    "closings.view",
    "closings.create",
    "closings.update",
    "closings.delete",
    "months.view",
    "months.create",
    "months.update",
    "months.delete",
    "reports.view",
    "reports.export",
];
async function ensureAdminRoleExists() {
    await prisma_1.prisma.$transaction(BOOTSTRAP_ADMIN_PERMISSIONS.map((key) => prisma_1.prisma.permission.upsert({
        where: { key },
        create: { key },
        update: {},
    })));
    let adminRole = await prisma_1.prisma.role.findFirst({ where: { name: "Admin" } });
    if (!adminRole) {
        adminRole = await prisma_1.prisma.role.create({
            data: { name: "Admin", description: "Acesso total ao sistema" },
        });
    }
    const perms = await prisma_1.prisma.permission.findMany({
        where: { key: { in: BOOTSTRAP_ADMIN_PERMISSIONS } },
        select: { id: true },
    });
    if (perms.length) {
        await prisma_1.prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
        await prisma_1.prisma.rolePermission.createMany({
            data: perms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
        });
    }
    return { id: adminRole.id };
}
async function ensureUserRoleExists() {
    let userRole = await prisma_1.prisma.role.findFirst({ where: { name: "User" } });
    if (userRole)
        return { id: userRole.id };
    userRole = await prisma_1.prisma.role.create({
        data: { name: "User", description: "Usuário padrão do sistema" },
    });
    const perms = await prisma_1.prisma.permission.findMany({
        where: { key: { in: ["dashboard.view"] } },
        select: { id: true },
    });
    if (perms.length) {
        await prisma_1.prisma.rolePermission.createMany({
            data: perms.map((p) => ({ roleId: userRole.id, permissionId: p.id })),
        });
    }
    return { id: userRole.id };
}
/** Garante Admin completo e perfil User básico (para o admin criar demais usuários). */
async function ensureDefaultRolesForBootstrap() {
    await ensureAdminRoleExists();
    await ensureUserRoleExists();
}
async function authRoutes(app) {
    const loginSchema = zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string(),
    });
    /** Indica se ainda não existe usuário (permite apenas o cadastro do primeiro admin). */
    app.get("/auth/bootstrap-status", async (_req, rep) => {
        const count = await prisma_1.prisma.user.count();
        return rep.send({ firstUserSetup: count === 0 });
    });
    /**
     * Cadastro público desativado.
     * Só permitido quando não existe nenhum usuário (bootstrap do primeiro administrador).
     */
    app.post("/register", async (req, rep) => {
        try {
            const bodySchema = zod_1.z.object({
                name: zod_1.z.string().min(1, "Nome é obrigatório"),
                email: zod_1.z.string().email("Email inválido"),
                password: zod_1.z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
            });
            const { name, email, password } = bodySchema.parse(req.body);
            const userCount = await prisma_1.prisma.user.count();
            if (userCount > 0) {
                return rep.code(403).send({
                    message: "Cadastro público desativado. Peça a um administrador para criar sua conta.",
                });
            }
            const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return rep.code(400).send({ message: "E-mail já está em uso" });
            }
            await ensureDefaultRolesForBootstrap();
            const adminRole = await prisma_1.prisma.role.findFirst({ where: { name: "Admin" } });
            if (!adminRole) {
                return rep.code(500).send({ message: "Perfil Admin não encontrado após bootstrap" });
            }
            const hashedPassword = await (0, auth_1.hashPassword)(password);
            const newUser = await prisma_1.prisma.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    roleId: adminRole.id,
                    status: "active",
                },
            });
            console.log("✅ Primeiro usuário do sistema (Admin):", {
                id: newUser.id,
                email: newUser.email,
            });
            return rep.code(201).send({
                message: "Primeiro administrador criado. Você pode fazer login.",
                user: {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                    role: "Admin",
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
            let user = null;
            try {
                user = await prisma_1.prisma.user.findUnique({
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
            }
            catch (includeError) {
                app.log.warn("Login: include role/permissions falhou, buscando só usuário:", includeError?.message);
                user = await prisma_1.prisma.user.findUnique({
                    where: { email },
                });
            }
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
            const permissions = user.role?.permissions
                ?.map((rp) => rp.permission?.key)
                .filter(Boolean) ?? [];
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

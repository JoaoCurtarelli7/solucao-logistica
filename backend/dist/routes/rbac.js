"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbacRoutes = rbacRoutes;
const prisma_1 = require("../lib/prisma");
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissionMiddleware_1 = require("../middlewares/permissionMiddleware");
const auth_1 = require("../lib/auth");
async function logAudit(userId, action, details) {
    await prisma_1.prisma.auditLog.create({
        data: {
            userId: userId ?? null,
            action,
            details: details ? JSON.stringify(details) : null,
        },
    });
}
async function rbacRoutes(app) {
    // Protege todas as rotas RBAC
    app.addHook("preHandler", authMiddleware_1.authMiddleware);
    // ---- Permissões ----
    app.get("/permissions", { preHandler: (0, permissionMiddleware_1.requirePermission)("users.manage") }, async (_req, rep) => {
        const permissions = await prisma_1.prisma.permission.findMany({
            orderBy: { key: "asc" },
            select: { id: true, key: true, description: true },
        });
        return rep.send(permissions);
    });
    // ---- Roles ----
    app.get("/roles", { preHandler: (0, permissionMiddleware_1.requirePermission)("users.manage") }, async (_req, rep) => {
        const roles = await prisma_1.prisma.role.findMany({
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                description: true,
                permissions: { select: { permission: { select: { key: true } } } },
            },
        });
        return rep.send(roles.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            permissions: r.permissions.map((rp) => rp.permission.key),
        })));
    });
    app.post("/roles", { preHandler: (0, permissionMiddleware_1.requirePermission)("users.manage") }, async (req, rep) => {
        const schema = zod_1.z.object({
            name: zod_1.z.string().min(2),
            description: zod_1.z.string().optional(),
        });
        const data = schema.parse(req.body);
        const role = await prisma_1.prisma.role.create({
            data: {
                name: data.name,
                description: data.description,
            },
            select: { id: true, name: true, description: true },
        });
        await logAudit(req.user?.id, "roles.create", { roleId: role.id, name: role.name });
        return rep.code(201).send(role);
    });
    app.put("/roles/:id", { preHandler: (0, permissionMiddleware_1.requirePermission)("users.manage") }, async (req, rep) => {
        const paramsSchema = zod_1.z.object({ id: zod_1.z.coerce.number() });
        const bodySchema = zod_1.z.object({
            name: zod_1.z.string().min(2),
            description: zod_1.z.string().nullable().optional(),
        });
        const { id } = paramsSchema.parse(req.params);
        const body = bodySchema.parse(req.body);
        const role = await prisma_1.prisma.role.update({
            where: { id },
            data: { name: body.name, description: body.description ?? undefined },
            select: { id: true, name: true, description: true },
        });
        await logAudit(req.user?.id, "roles.update", { roleId: role.id });
        return rep.send(role);
    });
    app.put("/roles/:id/permissions", { preHandler: (0, permissionMiddleware_1.requirePermission)("users.manage") }, async (req, rep) => {
        const paramsSchema = zod_1.z.object({ id: zod_1.z.coerce.number() });
        const bodySchema = zod_1.z.object({
            permissions: zod_1.z.array(zod_1.z.string().min(3)).default([]),
        });
        const { id: roleId } = paramsSchema.parse(req.params);
        const { permissions: keys } = bodySchema.parse(req.body);
        // Garante que as permissões existem
        const existing = await prisma_1.prisma.permission.findMany({
            where: { key: { in: keys } },
            select: { id: true, key: true },
        });
        const existingKeys = new Set(existing.map((p) => p.key));
        const missingKeys = keys.filter((k) => !existingKeys.has(k));
        if (missingKeys.length) {
            await prisma_1.prisma.permission.createMany({
                data: missingKeys.map((key) => ({ key })),
                skipDuplicates: true,
            });
        }
        const allPerms = await prisma_1.prisma.permission.findMany({
            where: { key: { in: keys } },
            select: { id: true, key: true },
        });
        await prisma_1.prisma.rolePermission.deleteMany({ where: { roleId } });
        if (allPerms.length) {
            await prisma_1.prisma.rolePermission.createMany({
                data: allPerms.map((p) => ({ roleId, permissionId: p.id })),
                skipDuplicates: true,
            });
        }
        const role = await prisma_1.prisma.role.findUnique({
            where: { id: roleId },
            select: {
                id: true,
                name: true,
                description: true,
                permissions: { select: { permission: { select: { key: true } } } },
            },
        });
        await logAudit(req.user?.id, "roles.permissions.set", { roleId, permissions: keys });
        return rep.send({
            id: role?.id,
            name: role?.name,
            description: role?.description,
            permissions: role?.permissions.map((rp) => rp.permission.key) ?? [],
        });
    });
    // ---- Usuários (Admin) ----
    app.get("/admin/users", { preHandler: (0, permissionMiddleware_1.requirePermission)("users.manage") }, async (req, rep) => {
        const querySchema = zod_1.z.object({
            search: zod_1.z.string().optional(),
            roleId: zod_1.z.coerce.number().optional(),
            status: zod_1.z.string().optional(),
        });
        const { search, roleId, status } = querySchema.parse(req.query);
        const where = {};
        if (status)
            where.status = status;
        if (roleId)
            where.roleId = roleId;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
            ];
        }
        const users = await prisma_1.prisma.user.findMany({
            where,
            orderBy: { id: "desc" },
            select: {
                id: true,
                name: true,
                email: true,
                status: true,
                createdAt: true,
                role: { select: { id: true, name: true } },
            },
        });
        return rep.send(users);
    });
    app.post("/admin/users", { preHandler: (0, permissionMiddleware_1.requirePermission)("users.manage") }, async (req, rep) => {
        const schema = zod_1.z.object({
            name: zod_1.z.string().min(2),
            email: zod_1.z.string().email(),
            roleId: zod_1.z.number(),
            status: zod_1.z.enum(["active", "inactive"]).default("active"),
            password: zod_1.z.string().min(6).optional(),
        });
        const body = schema.parse(req.body);
        const tempPassword = body.password ?? crypto_1.default.randomBytes(9).toString("base64url"); // ~12 chars
        const hashed = await (0, auth_1.hashPassword)(tempPassword);
        const user = await prisma_1.prisma.user.create({
            data: {
                name: body.name,
                email: body.email,
                password: hashed,
                status: body.status,
                roleId: body.roleId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                status: true,
                role: { select: { id: true, name: true } },
                createdAt: true,
            },
        });
        await logAudit(req.user?.id, "users.create", { userId: user.id, email: user.email, roleId: body.roleId });
        return rep.code(201).send({ user, tempPassword: body.password ? undefined : tempPassword });
    });
    app.put("/admin/users/:id", { preHandler: (0, permissionMiddleware_1.requirePermission)("users.manage") }, async (req, rep) => {
        const paramsSchema = zod_1.z.object({ id: zod_1.z.coerce.number() });
        const bodySchema = zod_1.z.object({
            name: zod_1.z.string().min(2),
            email: zod_1.z.string().email(),
            roleId: zod_1.z.number(),
            status: zod_1.z.enum(["active", "inactive"]),
        });
        const { id } = paramsSchema.parse(req.params);
        const body = bodySchema.parse(req.body);
        const user = await prisma_1.prisma.user.update({
            where: { id },
            data: {
                name: body.name,
                email: body.email,
                roleId: body.roleId,
                status: body.status,
            },
            select: { id: true, name: true, email: true, status: true, role: { select: { id: true, name: true } }, createdAt: true },
        });
        await logAudit(req.user?.id, "users.update", { userId: id });
        return rep.send(user);
    });
    app.patch("/admin/users/:id/status", { preHandler: (0, permissionMiddleware_1.requirePermission)("users.manage") }, async (req, rep) => {
        const paramsSchema = zod_1.z.object({ id: zod_1.z.coerce.number() });
        const bodySchema = zod_1.z.object({ status: zod_1.z.enum(["active", "inactive"]) });
        const { id } = paramsSchema.parse(req.params);
        const { status } = bodySchema.parse(req.body);
        const user = await prisma_1.prisma.user.update({
            where: { id },
            data: { status },
            select: { id: true, name: true, email: true, status: true, role: { select: { id: true, name: true } }, createdAt: true },
        });
        await logAudit(req.user?.id, "users.status.update", { userId: id, status });
        return rep.send(user);
    });
    // ---- Logs de auditoria ----
    app.get("/audit-logs", { preHandler: (0, permissionMiddleware_1.requirePermission)("users.manage") }, async (req, rep) => {
        const querySchema = zod_1.z.object({
            userId: zod_1.z.coerce.number().optional(),
            action: zod_1.z.string().optional(),
            page: zod_1.z.coerce.number().default(1),
            pageSize: zod_1.z.coerce.number().default(20),
        });
        const { userId, action, page, pageSize } = querySchema.parse(req.query);
        const where = {};
        if (userId)
            where.userId = userId;
        if (action)
            where.action = { contains: action, mode: "insensitive" };
        const [items, total] = await Promise.all([
            prisma_1.prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    action: true,
                    details: true,
                    createdAt: true,
                    user: { select: { id: true, name: true, email: true } },
                },
            }),
            prisma_1.prisma.auditLog.count({ where }),
        ]);
        return rep.send({ items, total, page, pageSize });
    });
}

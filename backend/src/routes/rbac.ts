import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "../types/fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import crypto from "crypto";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/permissionMiddleware";
import { hashPassword } from "../lib/auth";

async function logAudit(
  userId: number | null | undefined,
  action: string,
  details?: unknown,
) {
  await prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      action,
      details: details ? JSON.stringify(details) : null,
    },
  });
}

export async function rbacRoutes(app: FastifyInstance) {
  // Protege todas as rotas RBAC
  app.addHook("preHandler", authMiddleware);

  // ---- Permissões ----
  app.get(
    "/permissions",
    { preHandler: requirePermission("users.manage") },
    async (_req, rep) => {
      const permissions = await prisma.permission.findMany({
        orderBy: { key: "asc" },
        select: { id: true, key: true, description: true, createdAt: true },
      });
      return rep.send(permissions);
    },
  );

  app.post(
    "/permissions",
    { preHandler: requirePermission("users.manage") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      const schema = z.object({
        key: z.string().min(3).regex(/^[a-z]+\.[a-z]+$/, "Formato inválido. Use: modulo.acao"),
        description: z.string().optional(),
      });
      const data = schema.parse(req.body);

      const permission = await prisma.permission.create({
        data: {
          key: data.key,
          description: data.description,
        },
        select: { id: true, key: true, description: true, createdAt: true },
      });

      await logAudit(req.user?.id, "permissions.create", {
        permissionId: permission.id,
        key: permission.key,
      });
      return rep.code(201).send(permission);
    },
  );

  app.put(
    "/permissions/:id",
    { preHandler: requirePermission("users.manage") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      const paramsSchema = z.object({ id: z.coerce.number() });
      const bodySchema = z.object({
        key: z.string().min(3).regex(/^[a-z]+\.[a-z]+$/, "Formato inválido. Use: modulo.acao").optional(),
        description: z.string().nullable().optional(),
      });
      const { id } = paramsSchema.parse(req.params);
      const body = bodySchema.parse(req.body);

      const permission = await prisma.permission.update({
        where: { id },
        data: {
          ...(body.key && { key: body.key }),
          ...(body.description !== undefined && { description: body.description ?? null }),
        },
        select: { id: true, key: true, description: true, createdAt: true },
      });

      await logAudit(req.user?.id, "permissions.update", {
        permissionId: permission.id,
      });
      return rep.send(permission);
    },
  );

  app.delete(
    "/permissions/:id",
    { preHandler: requirePermission("users.manage") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      const paramsSchema = z.object({ id: z.coerce.number() });
      const { id } = paramsSchema.parse(req.params);

      // Verificar se a permissão está sendo usada
      const rolePermissions = await prisma.rolePermission.findFirst({
        where: { permissionId: id },
      });

      if (rolePermissions) {
        return rep.code(400).send({
          message: "Não é possível deletar permissão que está em uso por algum perfil",
        });
      }

      await prisma.permission.delete({
        where: { id },
      });

      await logAudit(req.user?.id, "permissions.delete", {
        permissionId: id,
      });
      return rep.code(204).send();
    },
  );

  // ---- Roles ----
  app.get(
    "/roles",
    { preHandler: requirePermission("users.manage") },
    async (_req, rep) => {
      const roles = await prisma.role.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      });

      return rep.send(
        roles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          permissions: r.permissions.map((rp) => rp.permission.key),
        })),
      );
    },
  );

  app.post(
    "/roles",
    { preHandler: requirePermission("users.manage") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      const schema = z.object({
        name: z.string().min(2),
        description: z.string().optional(),
      });
      const data = schema.parse(req.body);

      const role = await prisma.role.create({
        data: {
          name: data.name,
          description: data.description,
        },
        select: { id: true, name: true, description: true },
      });

      await logAudit(req.user?.id, "roles.create", {
        roleId: role.id,
        name: role.name,
      });
      return rep.code(201).send(role);
    },
  );

  app.put(
    "/roles/:id",
    { preHandler: requirePermission("users.manage") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      const paramsSchema = z.object({ id: z.coerce.number() });
      const bodySchema = z.object({
        name: z.string().min(2),
        description: z.string().nullable().optional(),
      });
      const { id } = paramsSchema.parse(req.params);
      const body = bodySchema.parse(req.body);

      const role = await prisma.role.update({
        where: { id },
        data: { name: body.name, description: body.description ?? undefined },
        select: { id: true, name: true, description: true },
      });

      await logAudit(req.user?.id, "roles.update", { roleId: role.id });
      return rep.send(role);
    },
  );

  app.put(
    "/roles/:id/permissions",
    { preHandler: requirePermission("users.manage") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      const paramsSchema = z.object({ id: z.coerce.number() });
      const bodySchema = z.object({
        permissions: z.array(z.string().min(3)).default([]),
      });
      const { id: roleId } = paramsSchema.parse(req.params);
      const { permissions: keys } = bodySchema.parse(req.body);

      // Garante que as permissões existem
      const existing = await prisma.permission.findMany({
        where: { key: { in: keys } },
        select: { id: true, key: true },
      });
      const existingKeys = new Set(existing.map((p) => p.key));
      const missingKeys = keys.filter((k) => !existingKeys.has(k));

      if (missingKeys.length) {
        await prisma.permission.createMany({
          data: missingKeys.map((key) => ({ key })),
          skipDuplicates: true,
        });
      }

      const allPerms = await prisma.permission.findMany({
        where: { key: { in: keys } },
        select: { id: true, key: true },
      });

      await prisma.rolePermission.deleteMany({ where: { roleId } });
      if (allPerms.length) {
        await prisma.rolePermission.createMany({
          data: allPerms.map((p) => ({ roleId, permissionId: p.id })),
          skipDuplicates: true,
        });
      }

      const role = await prisma.role.findUnique({
        where: { id: roleId },
        select: {
          id: true,
          name: true,
          description: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      });

      await logAudit(req.user?.id, "roles.permissions.set", {
        roleId,
        permissions: keys,
      });
      return rep.send({
        id: role?.id,
        name: role?.name,
        description: role?.description,
        permissions: role?.permissions.map((rp) => rp.permission.key) ?? [],
      });
    },
  );

  // ---- Usuários (Admin) ----
  app.get(
    "/admin/users",
    { preHandler: requirePermission("users.manage") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      const querySchema = z.object({
        search: z.string().optional(),
        roleId: z.coerce.number().optional(),
        status: z.string().optional(),
      });
      const { search, roleId, status } = querySchema.parse(req.query);

      const where: any = {};
      if (status) where.status = status;
      if (roleId) where.roleId = roleId;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }

      const users = await prisma.user.findMany({
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
    },
  );

  app.post(
    "/admin/users",
    { preHandler: requirePermission("users.manage") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      const schema = z.object({
        name: z.string().min(2),
        email: z.string().email(),
        roleId: z.number(),
        status: z.enum(["active", "inactive"]).default("active"),
        password: z.string().min(6).optional(),
      });
      const body = schema.parse(req.body);

      const tempPassword =
        body.password ?? crypto.randomBytes(9).toString("base64url"); // ~12 chars
      const hashed = await hashPassword(tempPassword);

      const user = await prisma.user.create({
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

      await logAudit(req.user?.id, "users.create", {
        userId: user.id,
        email: user.email,
        roleId: body.roleId,
      });
      return rep
        .code(201)
        .send({ user, tempPassword: body.password ? undefined : tempPassword });
    },
  );

  app.put(
    "/admin/users/:id",
    { preHandler: requirePermission("users.manage") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      const paramsSchema = z.object({ id: z.coerce.number() });
      const bodySchema = z.object({
        name: z.string().min(2),
        email: z.string().email(),
        roleId: z.number(),
        status: z.enum(["active", "inactive"]),
      });
      const { id } = paramsSchema.parse(req.params);
      const body = bodySchema.parse(req.body);

      const user = await prisma.user.update({
        where: { id },
        data: {
          name: body.name,
          email: body.email,
          roleId: body.roleId,
          status: body.status,
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

      await logAudit(req.user?.id, "users.update", { userId: id });
      return rep.send(user);
    },
  );

  app.patch(
    "/admin/users/:id/status",
    { preHandler: requirePermission("users.manage") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      const paramsSchema = z.object({ id: z.coerce.number() });
      const bodySchema = z.object({ status: z.enum(["active", "inactive"]) });
      const { id } = paramsSchema.parse(req.params);
      const { status } = bodySchema.parse(req.body);

      const user = await prisma.user.update({
        where: { id },
        data: { status },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          role: { select: { id: true, name: true } },
          createdAt: true,
        },
      });

      await logAudit(req.user?.id, "users.status.update", {
        userId: id,
        status,
      });
      return rep.send(user);
    },
  );

  // ---- Logs de auditoria ----
  app.get(
    "/audit-logs",
    { preHandler: requirePermission("users.manage") },
    async (req: FastifyRequest, rep: FastifyReply) => {
      const querySchema = z.object({
        userId: z.coerce.number().optional(),
        action: z.string().optional(),
        page: z.coerce.number().default(1),
        pageSize: z.coerce.number().default(20),
      });
      const { userId, action, page, pageSize } = querySchema.parse(req.query);

      const where: any = {};
      if (userId) where.userId = userId;
      if (action) where.action = { contains: action, mode: "insensitive" };

      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
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
        prisma.auditLog.count({ where }),
      ]);

      return rep.send({ items, total, page, pageSize });
    },
  );
}

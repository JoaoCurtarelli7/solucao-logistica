import type { FastifyReply, FastifyRequest } from "../types/fastify";
import { prisma } from "../lib/prisma";
import { verifyToken } from "../lib/auth";

async function checkPlan(tenantId: number, rep: FastifyReply): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { planExpiresAt: true, status: true },
  });

  if (!tenant) return true;

  if (tenant.status === "suspended") {
    rep.code(403).send({ message: "Conta suspensa. Entre em contato com o suporte.", code: "ACCOUNT_SUSPENDED" });
    return false;
  }

  if (tenant.planExpiresAt && tenant.planExpiresAt < new Date()) {
    rep.code(402).send({
      message: "Seu plano expirou. Entre em contato para renovar o acesso.",
      code: "PLAN_EXPIRED",
      expiredAt: tenant.planExpiresAt,
    });
    return false;
  }

  return true;
}

export async function authMiddleware(req: FastifyRequest, rep: FastifyReply) {
  try {
    const auth = req.headers?.authorization;

    if (!auth) {
      return rep.status(401).send({ message: "Token ausente" });
    }

    const parts = auth.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return rep.status(401).send({ message: "Formato de token inválido. Use: Bearer <token>" });
    }

    const token = parts[1];
    if (!token) {
      return rep.status(401).send({ message: "Token ausente" });
    }

    try {
      const decoded: any = verifyToken(token);

      if (!decoded.userId) {
        return rep.status(401).send({ message: "Token inválido - userId não encontrado" });
      }

      const userId = Number(decoded.userId);
      const tokenTenantId = decoded.tenantId ? Number(decoded.tenantId) : undefined;
      const tokenIsSuperAdmin = decoded.isSuperAdmin === true;
      const tokenPermissions = Array.isArray(decoded.permissions) ? decoded.permissions : undefined;
      const tokenRoleId = decoded.roleId ?? undefined;
      const tokenRole = decoded.role ?? undefined;

      if (tokenPermissions && tokenTenantId !== undefined) {
        req.user = {
          id: userId,
          tenantId: tokenTenantId,
          isSuperAdmin: tokenIsSuperAdmin,
          roleId: tokenRoleId ?? null,
          role: tokenRole ?? null,
          permissions: tokenPermissions,
        };
        if (!tokenIsSuperAdmin && tokenTenantId) {
          const allowed = await checkPlan(tokenTenantId, rep);
          if (!allowed) return;
        }
        return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
          tenantId: true,
          isSuperAdmin: true,
          role: {
            select: {
              id: true,
              name: true,
              permissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          },
        },
      });

      if (!dbUser) {
        return rep.status(401).send({ message: "Usuário não encontrado" });
      }

      if (dbUser.status && dbUser.status !== "active") {
        return rep.status(403).send({ message: "Usuário inativo" });
      }

      let permissions: string[] =
        dbUser.role?.permissions?.map((rp: any) => rp.permission?.key).filter(Boolean) ?? [];

      if (permissions.length === 0) {
        try {
          const allPerms = await prisma.permission.findMany({ select: { key: true } });
          permissions = allPerms.map((p) => p.key);
        } catch {
          permissions = ["users.manage"];
        }
      }

      req.user = {
        id: dbUser.id,
        tenantId: dbUser.tenantId,
        isSuperAdmin: dbUser.isSuperAdmin,
        status: dbUser.status ?? undefined,
        roleId: dbUser.role?.id ?? null,
        role: dbUser.role?.name ?? null,
        permissions,
      };
      if (!dbUser.isSuperAdmin && dbUser.tenantId) {
        const allowed = await checkPlan(dbUser.tenantId, rep);
        if (!allowed) return;
      }
    } catch (jwtError: any) {
      if (jwtError.name === "TokenExpiredError") {
        return rep.status(401).send({ message: "Token expirado" });
      }
      if (jwtError.name === "JsonWebTokenError") {
        return rep.status(401).send({ message: "Token inválido" });
      }
      return rep.status(401).send({ message: "Token inválido ou expirado" });
    }
  } catch (error: any) {
    console.error("Erro no middleware de autenticação:", error.message);
    return rep.status(401).send({ message: "Erro na autenticação" });
  }
}

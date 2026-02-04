import type { FastifyReply, FastifyRequest } from "../types/fastify";
import { prisma } from "../lib/prisma";
import { verifyToken } from "../lib/auth";

export async function authMiddleware(req: FastifyRequest, rep: FastifyReply) {
  try {
    const auth = req.headers?.authorization;

    if (!auth) {
      return rep.status(401).send({ message: "Token ausente" });
    }

    const parts = auth.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return rep
        .status(401)
        .send({ message: "Formato de token inválido. Use: Bearer <token>" });
    }

    const token = parts[1];

    if (!token) {
      return rep.status(401).send({ message: "Token ausente" });
    }

    try {
      const decoded: any = verifyToken(token);

      if (!decoded.userId) {
        return rep
          .status(401)
          .send({ message: "Token inválido - userId não encontrado" });
      }

      const userId = Number(decoded.userId);
      const tokenPermissions = Array.isArray(decoded.permissions)
        ? decoded.permissions
        : undefined;
      const tokenRoleId = decoded.roleId ?? undefined;
      const tokenRole = decoded.role ?? undefined;

      // Se o token já vier com permissões, usa; senão busca no banco (bom para compatibilidade)
      if (tokenPermissions) {
        req.user = {
          id: userId,
          roleId: tokenRoleId ?? null,
          role: tokenRole ?? null,
          permissions: tokenPermissions,
        };
        return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
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
        },
      });

      if (!dbUser) {
        return rep.status(401).send({ message: "Usuário não encontrado" });
      }

      if (dbUser.status && dbUser.status !== "active") {
        return rep.status(403).send({ message: "Usuário inativo" });
      }

      const permissions =
        dbUser.role?.permissions?.map((rp) => rp.permission.key) ?? [];

      req.user = {
        id: dbUser.id,
        status: dbUser.status,
        roleId: dbUser.role?.id ?? null,
        role: dbUser.role?.name ?? null,
        permissions,
      };
      // Não retorna nada, continua para o próximo handler
    } catch (jwtError: any) {
      console.error("Erro ao verificar token:", jwtError.message);

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

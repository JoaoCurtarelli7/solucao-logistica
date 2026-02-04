import type { FastifyReply, FastifyRequest } from "../types/fastify";

export function requirePermission(permissionKey: string) {
  return async (req: FastifyRequest, rep: FastifyReply) => {
    const permissions = req.user?.permissions ?? [];
    if (!permissions.includes(permissionKey)) {
      return rep.code(403).send({ message: "Sem permissão para esta ação" });
    }
  };
}

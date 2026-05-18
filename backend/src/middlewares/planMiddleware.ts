import type { FastifyReply, FastifyRequest } from "../types/fastify";
import { prisma } from "../lib/prisma";

export async function planMiddleware(req: FastifyRequest, rep: FastifyReply) {
  if (!req.user) return;
  if (req.user.isSuperAdmin) return;

  const tenantId = req.user.tenantId;
  if (!tenantId) return;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, planExpiresAt: true, status: true },
  });

  if (!tenant) return;

  if (tenant.status === "suspended") {
    return rep.code(403).send({
      message: "Conta suspensa. Entre em contato com o suporte.",
      code: "ACCOUNT_SUSPENDED",
    });
  }

  if (tenant.planExpiresAt && tenant.planExpiresAt < new Date()) {
    return rep.code(402).send({
      message: "Seu plano expirou. Entre em contato com o administrador para renovar o acesso.",
      code: "PLAN_EXPIRED",
      expiredAt: tenant.planExpiresAt,
    });
  }
}

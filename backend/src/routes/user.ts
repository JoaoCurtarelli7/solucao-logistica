import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";
import { authMiddleware } from "../middlewares/authMiddleware";
import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
} from "../types/fastify";

export async function userRoutes(app: FastifyInstance) {
  // Aplicar autenticação em todas as rotas
  app.addHook("preHandler", authMiddleware);

  // Obter dados do usuário logado (com role e permissões para o front)
  app.get("/me", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ message: "Usuário não autenticado" });
      }
      const userId = request.user.id;

      let user: any = null;
      try {
        user = await prisma.user.findUnique({
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
          },
        });
      } catch (includeErr: any) {
        app.log.warn("GET /me: include role falhou, buscando só usuário:", includeErr?.message);
        try {
          user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              createdAt: true,
            },
          });
          if (user) (user as any).status = null;
        } catch (fallbackErr: any) {
          app.log.error("GET /me fallback também falhou:", fallbackErr?.message);
          throw fallbackErr;
        }
      }

      if (!user) {
        return reply.code(404).send({ message: "Usuário não encontrado" });
      }

      const permissions: string[] =
        user.role?.permissions?.map((rp: { permission?: { key?: string } }) => rp.permission?.key).filter(Boolean) ?? [];
      const role = user.role ? { id: user.role.id, name: user.role.name } : null;

      return reply.send({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        address: user.address ?? null,
        status: user.status ?? null,
        createdAt: user.createdAt,
        role,
        permissions,
      });
    } catch (error: any) {
      console.error("Erro ao buscar usuário /me:", error);
      return reply.code(500).send({
        message: "Erro interno do servidor",
        error: error?.message ?? undefined,
      });
    }
  });

  // Editar dados do perfil do usuário logado
  app.put("/me", async (request: FastifyRequest, reply: FastifyReply) => {
    const updateUserSchema = z.object({
      name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
      email: z.string().email("Email inválido"),
      phone: z.string().optional(),
      address: z.string().optional(),
    });

    try {
      if (!request.user) {
        return reply.code(401).send({ message: "Usuário não autenticado" });
      }
      const userId = request.user.id;
      const data = updateUserSchema.parse(
        request.body as unknown as z.infer<typeof updateUserSchema>,
      );

      // Verificar se o email já está em uso por outro usuário
      if (data.email) {
        const existingUser = await prisma.user.findFirst({
          where: {
            email: data.email,
            id: { not: userId },
          },
        });

        if (existingUser) {
          return reply
            .code(400)
            .send({ message: "Este email já está em uso por outro usuário" });
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          address: data.address || null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          createdAt: true,
        },
      });

      return reply.send({
        message: "Perfil atualizado com sucesso!",
        user: updatedUser,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          message: "Dados inválidos",
          errors: error.errors,
        });
      }

      console.error("Erro ao atualizar usuário:", error);
      return reply.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Alterar senha do usuário logado
  app.patch(
    "/me/password",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const changePasswordSchema = z.object({
        currentPassword: z.string().min(1, "Senha atual é obrigatória"),
        newPassword: z
          .string()
          .min(6, "Nova senha deve ter pelo menos 6 caracteres"),
      });

      try {
        if (!request.user) {
          return reply.code(401).send({ message: "Usuário não autenticado" });
        }
        const userId = request.user.id;
        const { currentPassword, newPassword } = changePasswordSchema.parse(
          request.body,
        );

        // Buscar usuário com senha para verificação
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          return reply.code(404).send({ message: "Usuário não encontrado" });
        }

        // Verificar senha atual
        const passwordMatch = await bcrypt.compare(
          currentPassword,
          user.password,
        );
        if (!passwordMatch) {
          return reply.code(401).send({ message: "Senha atual incorreta" });
        }

        // Verificar se a nova senha é diferente da atual
        const newPasswordMatch = await bcrypt.compare(
          newPassword,
          user.password,
        );
        if (newPasswordMatch) {
          return reply
            .code(400)
            .send({
              message: "A nova senha deve ser diferente da senha atual",
            });
        }

        // Criptografar nova senha
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Atualizar senha
        await prisma.user.update({
          where: { id: userId },
          data: { password: hashedNewPassword },
        });

        return reply.send({ message: "Senha alterada com sucesso!" });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            message: "Dados inválidos",
            errors: error.errors,
          });
        }

        console.error("Erro ao alterar senha:", error);
        return reply.code(500).send({ message: "Erro interno do servidor" });
      }
    },
  );

  // Obter estatísticas do usuário (opcional)
  app.get("/me/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ message: "Usuário não autenticado" });
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
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      return reply.code(500).send({ message: "Erro interno do servidor" });
    }
  });
}

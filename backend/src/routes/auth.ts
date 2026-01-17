import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { hashPassword } from "../lib/auth";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export async function authRoutes(app: FastifyInstance) {
  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
  });

  app.post("/register", async (req, rep) => {
    try {
      const bodySchema = z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      });

      const { name, email, password } = bodySchema.parse(req.body);

      // Verificar se o usuário já existe
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return rep.code(400).send({ message: "E-mail já está em uso" });
      }

      // Hash da senha
      const hashedPassword = await hashPassword(password);

      // Criar usuário - o Prisma cuida automaticamente do createdAt
      const newUser = await prisma.user.create({
        data: { 
          name, 
          email, 
          password: hashedPassword 
          // createdAt será gerado automaticamente pelo Prisma
        },
      });

      console.log("✅ Usuário criado com sucesso:", { id: newUser.id, email: newUser.email });

      return rep.code(201).send({ 
        message: "Usuário criado com sucesso!",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email
        }
      });
    } catch (error: any) {
      console.error("❌ Erro ao registrar usuário:", error);
      console.error("Detalhes:", {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
        stack: error?.stack
      });

      // Erros de validação (Zod)
      if (error.name === 'ZodError') {
        return rep.code(400).send({ 
          message: "Dados inválidos",
          errors: error.errors
        });
      }

      // Erro de violação de unicidade (email duplicado)
      if (error.code === 'P2002') {
        return rep.code(400).send({ 
          message: "E-mail já está em uso",
          field: error.meta?.target?.[0] || 'email'
        });
      }

      // Erro genérico
      return rep.code(500).send({ 
        message: "Erro ao criar usuário",
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  });

  app.post("/login", async (req, rep) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return rep.code(401).send({ message: "Email ou senha inválidos" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return rep.code(401).send({ message: "Email ou senha inválidos" });
      }

      const token = jwt.sign({ userId: user.id }, "secreta-chave", { expiresIn: "1h" });

      return rep.send({ 
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error: any) {
      console.error("❌ Erro no login:", error);
      console.error("Detalhes:", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      });

      // Erros de validação (Zod)
      if (error.name === 'ZodError') {
        return rep.code(400).send({ 
          message: "Dados inválidos",
          errors: error.errors
        });
      }

      return rep.code(500).send({ 
        message: "Erro no servidor",
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  });
}

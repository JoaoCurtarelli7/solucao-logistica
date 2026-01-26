// src/routes/employee.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middlewares/authMiddleware";

function parseMaybeBrDate(str?: string | null) {
  if (!str) return null;
  const s = String(str).trim();
  if (!s) return null;
  // aceita DD/MM/YYYY ou YYYY-MM-DDTHH:mm...
  if (s.includes("/")) {
    const [day, month, year] = s.split("/");
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(s);
}

export async function employeeRoutes(app: FastifyInstance) {
  const paramsSchema = z.object({
    id: z.coerce.number(),
  });

  const bodySchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    role: z.string().min(2, "Cargo deve ter pelo menos 2 caracteres"),
    baseSalary: z.coerce.number().min(0, "Salário deve ser maior que zero"),
    status: z.enum(["Ativo", "Inativo"]),
    cpf: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    address: z.string().optional(),
    hireDate: z.string().optional().transform(parseMaybeBrDate),
  });

  app.addHook("preHandler", authMiddleware);

  // LISTAR
  app.get("/employees", async (_req: FastifyRequest, rep: FastifyReply) => {
    try {
      const employees = await prisma.employee.findMany({
        select: {
          id: true,
          name: true,
          role: true,
          baseSalary: true,
          status: true,
          cpf: true,
          phone: true,
          email: true,
          address: true,
          hireDate: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return rep.send(employees);
    } catch (error) {
      console.error("Erro ao buscar funcionários:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // OBTER POR ID
  app.get("/employees/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);

      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          Transaction: { orderBy: { date: "desc" } }, // relação conforme seu schema
        },
      });

      if (!employee) {
        return rep.code(404).send({ message: "Funcionário não encontrado" });
      }
      return rep.send(employee);
    } catch (error) {
      console.error("Erro ao buscar funcionário:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // CRIAR
  app.post("/employees", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const data = bodySchema.parse(req.body);

      // CPF duplicado? (se fornecer CPF e não for vazio)
      if (data.cpf && data.cpf.trim() !== "") {
        const exists = await prisma.employee.findFirst({
          where: { cpf: data.cpf },
          select: { id: true },
        });
        if (exists) {
          return rep.code(400).send({ message: "CPF já cadastrado" });
        }
      }

      const hireDate = data.hireDate ?? new Date();

      const employee = await prisma.employee.create({
        data: {
          name: data.name,
          role: data.role,
          baseSalary: data.baseSalary,
          status: data.status,
          cpf: data.cpf && data.cpf.trim() !== "" ? data.cpf : null,
          phone: data.phone && data.phone.trim() !== "" ? data.phone : null,
          email: data.email && data.email.trim() !== "" ? data.email : null,
          address: data.address && data.address.trim() !== "" ? data.address : null,
          hireDate,
          // createdAt/updatedAt seguem defaults do banco/schema
        },
      });

      return rep.code(201).send(employee);
    } catch (error) {
      console.error("Erro ao criar funcionário:", error);
      if (error instanceof z.ZodError) {
        return rep.code(400).send({
          message: "Dados inválidos",
          errors: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }
      // Prisma unique (se em algum momento você tornar cpf único):
      // if ((error as any)?.code === "P2002") { ... }
      return rep.code(500).send({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // ATUALIZAR
  app.put("/employees/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const data = bodySchema.parse(req.body);

      const existing = await prisma.employee.findUnique({ where: { id } });
      if (!existing) {
        return rep.code(404).send({ message: "Funcionário não encontrado" });
      }

      // CPF duplicado em outro registro?
      if (data.cpf && data.cpf.trim() !== "" && data.cpf !== existing.cpf) {
        const duplicate = await prisma.employee.findFirst({
          where: { cpf: data.cpf, NOT: { id } },
          select: { id: true },
        });
        if (duplicate) {
          return rep.code(400).send({ message: "CPF já cadastrado" });
        }
      }

      const hireDate = data.hireDate ?? existing.hireDate;

      const updated = await prisma.employee.update({
        where: { id },
        data: {
          name: data.name,
          role: data.role,
          baseSalary: data.baseSalary,
          status: data.status,
          cpf: data.cpf && data.cpf.trim() !== "" ? data.cpf : null,
          phone: data.phone && data.phone.trim() !== "" ? data.phone : null,
          email: data.email && data.email.trim() !== "" ? data.email : null,
          address: data.address && data.address.trim() !== "" ? data.address : null,
          hireDate,
          updatedAt: new Date(),
        },
      });

      return rep.send(updated);
    } catch (error) {
      console.error("Erro ao atualizar funcionário:", error);
      if (error instanceof z.ZodError) {
        return rep.code(400).send({
          message: "Dados inválidos",
          errors: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }
      return rep.code(500).send({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // DELETAR
  app.delete("/employees/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);

      const existing = await prisma.employee.findUnique({ where: { id } });
      if (!existing) {
        return rep.code(404).send({ message: "Funcionário não encontrado" });
      }

      await prisma.employee.delete({ where: { id } });
      return rep.code(204).send();
    } catch (error) {
      console.error("Erro ao deletar funcionário:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // LISTAR TRANSAÇÕES DO FUNCIONÁRIO
  app.post("/employees/:id/transactions", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
  
      const transactionSchema = z.object({
        type: z.enum(["Crédito", "Débito"]),
        amount: z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
        date: z.string().optional(), // aceita ISO; se vier vazio, usa agora
      });
  
      const { type, amount, date } = transactionSchema.parse(req.body);
  
      // garante que o funcionário existe (evita criar "solto")
      await prisma.employee.findUniqueOrThrow({ where: { id } });
  
      const transactionDate = date ? new Date(date) : new Date();
  
      // ✅ cria já vinculado via relação (não usa employeeId direto)
      const transaction = await prisma.transaction.create({
        data: {
          type,
          amount,
          date: transactionDate,
          Employee: { connect: { id } }, // <- este é o pulo do gato
        },
      });
  
      return rep.code(201).send(transaction);
    } catch (error) {
      if ((error as any)?.code === "P2025") {
        return rep.code(404).send({ message: "Funcionário não encontrado" });
      }
      console.error("Erro ao criar transação:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });
  
  // Listar transações do funcionário (opção 1: via relação)
  app.get("/employees/:id/transactions", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
  
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          Transaction: {
            select: { id: true, type: true, amount: true, date: true },
            orderBy: { date: "desc" },
          },
        },
      });
  
      if (!employee) {
        return rep.code(404).send({ message: "Funcionário não encontrado" });
      }
  
      return rep.send(employee.Transaction);
    } catch (error) {
      console.error("Erro ao buscar transações:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });
  // BUSCA COM FILTROS
  app.get("/employees/search", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const querySchema = z.object({
        name: z.string().optional(),
        role: z.string().optional(),
        status: z.string().optional(),
      });

      const { name, role, status } = querySchema.parse(req.query);

      const where: any = {};
      if (name) where.name = { contains: name };
      if (role) where.role = { contains: role };
      if (status) where.status = status;

      const employees = await prisma.employee.findMany({
        where,
        select: {
          id: true,
          name: true,
          role: true,
          baseSalary: true,
          status: true,
          cpf: true,
          phone: true,
          email: true,
          address: true,
          hireDate: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
      });

      return rep.send(employees);
    } catch (error) {
      console.error("Erro na busca de funcionários:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });
}

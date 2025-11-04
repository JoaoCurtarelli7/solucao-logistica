import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/authMiddleware";

export async function monthRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  const createMonthSchema = z.object({
    year: z.coerce.number().min(2020).max(2030),
    month: z.coerce.number().min(1).max(12),
  });

  const updateMonthSchema = z.object({
    status: z.enum(["aberto", "fechado", "cancelado"]).optional(),
  });

  // Listar meses
  app.get("/months", async (req, rep) => {
    try {
      const querySchema = z.object({
        year: z.string().optional(),
        status: z.string().optional(),
      });

      const { year, status } = querySchema.parse(req.query);

      let whereClause: any = {};

      if (year) {
        whereClause.year = parseInt(year);
      }

      if (status) {
        whereClause.status = status;
      }

      const months = await prisma.month.findMany({
        where: whereClause,
        orderBy: [
          { year: 'desc' },
          { month: 'desc' },
        ],
      });

      return rep.send(months || []);
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Obter mês por ID
  app.get("/months/:id", async (req, rep) => {
    try {
      const { id } = z.object({ id: z.coerce.number() }).parse(req.params);

      const month = await prisma.month.findUnique({
        where: { id },
        include: {
          Closing: {
            include: {
              Company: {
                select: { id: true, name: true, cnpj: true },
              },
              FinancialEntry: true,
            },
          },
        },
      });

      if (!month) {
        return rep.code(404).send({ message: "Mês não encontrado" });
      }

      return rep.send(month);
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Criar novo mês
  app.post("/months", async (req, rep) => {
    try {
      const body = req.body;
      const { year, month: monthNumber } = createMonthSchema.parse(body);

      const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
      ];

      const monthName = `${monthNames[monthNumber - 1]} ${year}`;

      const createdMonth = await prisma.month.create({
        data: {
          year,
          month: monthNumber,
          name: monthName,
          status: 'aberto',
        },
      });

      return rep.code(201).send(createdMonth);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return rep.code(400).send({ 
          message: "Dados inválidos", 
          errors: error.errors 
        });
      }
      // Erro de duplicata (unique constraint)
      if (error.code === 'P2002') {
        return rep.code(409).send({ 
          message: "Este mês já existe", 
          error: "Já existe um mês com este ano e mês"
        });
      }
      if (error instanceof Error) {
        return rep.code(400).send({ 
          message: "Erro ao criar mês", 
          error: error.message 
        });
      }
      return rep.code(500).send({ 
        message: "Erro interno do servidor",
        error: error?.message || 'Erro desconhecido'
      });
    }
  });

  // Atualizar mês
  app.put("/months/:id", async (req, rep) => {
    try {
      const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
      const data = updateMonthSchema.parse(req.body);

      const updatedMonth = await prisma.month.update({
        where: { id },
        data,
        include: {
          Closing: {
            include: {
              Company: {
                select: { id: true, name: true, cnpj: true },
              },
            },
          },
        },
      });

      return rep.send(updatedMonth);
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Deletar mês
  app.delete("/months/:id", async (req, rep) => {
    try {
      const { id } = z.object({ id: z.coerce.number() }).parse(req.params);

      const month = await prisma.month.findUnique({
        where: { id },
        include: { Closing: true },
      });

      if (!month) {
        return rep.code(404).send({ message: "Mês não encontrado" });
      }

      if (month.Closing.length > 0) {
        return rep.code(400).send({
          message: "Não é possível deletar um mês que possui fechamentos",
        });
      }

      await prisma.month.delete({ where: { id } });

      return rep.send({ message: "Mês deletado com sucesso" });
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  // Estatísticas do mês
  app.get("/months/:id/stats", async (req, rep) => {
    try {
      const { id } = z.object({ id: z.coerce.number() }).parse(req.params);

      const month = await prisma.month.findUnique({
        where: { id },
        include: {
          Closing: {
            include: { FinancialEntry: true },
          },
        },
      });

      if (!month) {
        return rep.code(404).send({ message: "Mês não encontrado" });
      }

      const totalClosings = month.Closing.length;
      const closedClosings = month.Closing.filter(c => c.status === "fechado").length;

      const allEntries = month.Closing.flatMap(c => c.FinancialEntry);
      const totalEntries = allEntries.filter(e => e.type === "entrada").reduce((sum, e) => sum + e.amount, 0);
      const totalExpenses = allEntries.filter(e => e.type === "saida").reduce((sum, e) => sum + e.amount, 0);
      const totalTaxes = allEntries.filter(e => e.type === "imposto").reduce((sum, e) => sum + e.amount, 0);
      const balance = totalEntries - totalExpenses - totalTaxes;

      return rep.send({
        month: {
          id: month.id,
          name: month.name,
          year: month.year,
          month: month.month,
          status: month.status,
        },
        stats: {
          totalClosings,
          closedClosings,
          openClosings: totalClosings - closedClosings,
          totalEntries,
          totalExpenses,
          totalTaxes,
          balance,
          profitMargin: totalEntries > 0 ? (balance / totalEntries) * 100 : 0,
        },
      });
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });
}

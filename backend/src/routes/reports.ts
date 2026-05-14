import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { authMiddleware } from "../middlewares/authMiddleware";

export async function reportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/reports/system-overview", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const [
        totalEmployees,
        activeEmployees,
        totalCompanies,
        activeCompanies,
        totalLoads,
        totalTrucks,
        totalMaintenance,
        totalTransactions
      ] = await Promise.all([
        prisma.employee.count({ where: { tenantId } }),
        prisma.employee.count({ where: { tenantId, status: "Ativo" } }),
        prisma.company.count({ where: { tenantId } }),
        prisma.company.count({ where: { tenantId, status: "Ativo" } }),
        prisma.load.count({ where: { tenantId } }),
        prisma.truck.count({ where: { tenantId } }),
        prisma.maintenance.count({ where: { Truck: { tenantId } } }),
        prisma.transaction.count({ where: { Employee: { tenantId } } }),
      ]);

      return rep.send({
        summary: {
          totalEmployees,
          activeEmployees,
          inactiveEmployees: totalEmployees - activeEmployees,
          totalCompanies,
          activeCompanies,
          inactiveCompanies: totalCompanies - activeCompanies,
          totalLoads,
          totalTrucks,
          totalMaintenance,
          totalTransactions
        },
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao gerar relatório geral:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.get("/reports/employees", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const { status, startDate, endDate } = z.object({
        status: z.enum(["Ativo", "Inativo"]).optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.string().optional(),
      }).parse(req.query);

      const whereClause: any = { tenantId };

      if (status) whereClause.status = status;

      if (startDate && endDate) {
        whereClause.hireDate = {
          gte: new Date(startDate as unknown as string),
          lte: new Date(endDate as string)
        };
      }

      const employees = await prisma.employee.findMany({
        where: whereClause,
        include: {
          Transaction: {
            orderBy: { date: 'desc' },
            take: 5
          }
        },
        orderBy: { name: 'asc' }
      });

      const totalSalary = employees
        .filter(emp => emp.status === 'Ativo')
        .reduce((sum, emp) => sum + emp.baseSalary, 0);

      return rep.send({
        employees,
        summary: {
          total: employees.length,
          active: employees.filter(emp => emp.status === 'Ativo').length,
          inactive: employees.filter(emp => emp.status === 'Inativo').length,
          totalSalary
        },
        filters: { status, startDate, endDate },
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao gerar relatório de funcionários:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.get("/reports/companies", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const { status, startDate, endDate } = z.object({
        status: z.enum(["Ativo", "Inativo"]).optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.string().optional(),
      }).parse(req.query);

      const whereClause: any = { tenantId };

      if (status) whereClause.status = status;

      if (startDate && endDate) {
        whereClause.dateRegistration = {
          gte: new Date(startDate as unknown as string),
          lte: new Date(endDate as string)
        };
      }

      const companies = await prisma.company.findMany({
        where: whereClause,
        include: {
          Load: {
            orderBy: { date: 'desc' },
            take: 3
          }
        },
        orderBy: { name: 'asc' }
      });

      return rep.send({
        companies,
        summary: {
          total: companies.length,
          active: companies.filter(comp => comp.status === 'Ativo').length,
          inactive: companies.filter(comp => comp.status === 'Inativo').length
        },
        filters: { status, startDate, endDate },
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao gerar relatório de empresas:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.get("/reports/loads", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const { startDate, endDate, companyId } = z.object({
        startDate: z.coerce.date().optional(),
        endDate: z.string().optional(),
        companyId: z.coerce.number().optional(),
      }).parse(req.query);

      const whereClause: any = { tenantId };

      if (companyId) whereClause.companyId = companyId;

      if (startDate && endDate) {
        whereClause.date = {
          gte: new Date(startDate as unknown as string),
          lte: new Date(endDate as string)
        };
      }

      const loads = await prisma.load.findMany({
        where: whereClause,
        include: { Company: true },
        orderBy: { date: 'desc' }
      });

      const totalValue = loads.reduce((sum, load) => sum + (load.totalValue || 0), 0);

      return rep.send({
        loads,
        summary: {
          total: loads.length,
          totalValue,
        },
        filters: { startDate, endDate, companyId },
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao gerar relatório de cargas:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.get("/reports/maintenance", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const { startDate, endDate, truckId } = z.object({
        startDate: z.coerce.date().optional(),
        endDate: z.string().optional(),
        truckId: z.coerce.number().optional(),
      }).parse(req.query);

      const whereClause: any = { Truck: { tenantId } };

      if (truckId) whereClause.truckId = truckId;

      if (startDate && endDate) {
        whereClause.date = {
          gte: new Date(startDate as unknown as string),
          lte: new Date(endDate as unknown as string)
        };
      }

      const maintenance = await prisma.maintenance.findMany({
        where: whereClause,
        include: {
          Truck: { select: { id: true, name: true, plate: true } }
        },
        orderBy: { date: 'desc' }
      });

      const totalCost = maintenance.reduce((sum, maint) => sum + (maint.value || 0), 0);

      return rep.send({
        maintenance,
        summary: {
          total: maintenance.length,
          totalCost,
          averageCost: maintenance.length > 0 ? totalCost / maintenance.length : 0
        },
        filters: { startDate, endDate, truckId },
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao gerar relatório de manutenções:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.get("/reports/financial", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const { startDate, endDate, type } = z.object({
        startDate: z.coerce.date().optional(),
        endDate: z.string().optional(),
        type: z.enum(["Crédito", "Débito"]).optional(),
      }).parse(req.query);

      const whereClause: any = { Employee: { tenantId } };

      if (type) whereClause.type = type;

      if (startDate && endDate) {
        whereClause.date = {
          gte: new Date(startDate as unknown as string),
          lte: new Date(endDate as unknown as string)
        };
      }

      const transactions = await prisma.transaction.findMany({
        where: whereClause,
        include: { Employee: true },
        orderBy: { date: 'desc' }
      });

      const totalCredits = transactions
        .filter(t => t.type === 'Crédito')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalDebits = transactions
        .filter(t => t.type === 'Débito')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      return rep.send({
        transactions,
        summary: {
          total: transactions.length,
          totalCredits,
          totalDebits,
          balance: totalCredits - totalDebits,
        },
        filters: { startDate, endDate, type },
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao gerar relatório financeiro:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.get("/reports/trips", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const { startDate, endDate, truckId, status } = z.object({
        startDate: z.coerce.date().optional(),
        endDate: z.string().optional(),
        truckId: z.coerce.number().optional(),
        status: z.enum(["em_andamento", "finalizado"]).optional(),
      }).parse(req.query);

      const whereClause: any = { tenantId };

      if (status) whereClause.status = status;
      if (truckId) whereClause.truckId = truckId;

      if (startDate && endDate) {
        whereClause.date = {
          gte: new Date(startDate as unknown as string),
          lte: new Date(endDate as unknown as string)
        };
      }

      const trips = await prisma.trip.findMany({
        where: whereClause,
        include: {
          Truck: { select: { id: true, name: true, plate: true } },
          TripExpense: { orderBy: { date: 'desc' } }
        },
        orderBy: { date: 'desc' }
      });

      const totalExpenses = trips.reduce((sum, trip) => {
        return sum + trip.TripExpense.reduce((expSum, exp) => expSum + (exp.amount || 0), 0);
      }, 0);

      return rep.send({
        trips,
        summary: {
          total: trips.length,
          totalExpenses,
          byStatus: trips.reduce((acc, trip) => {
            acc[trip.status] = (acc[trip.status] || 0) + 1;
            return acc;
          }, {} as any)
        },
        filters: { startDate, endDate, truckId, status },
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao gerar relatório de viagens:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.post("/reports/custom", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const { reportType, filters, startDate, endDate, groupBy, sortBy, limit } = z.object({
        reportType: z.enum(["employees", "financial", "operations"]),
        filters: z.any().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.string().optional(),
        groupBy: z.string().optional(),
        sortBy: z.string().optional(),
        limit: z.coerce.number().optional(),
      }).parse(req.body);

      let result: any = {};

      switch (reportType) {
        case 'employees':
          result = await generateEmployeeReport(filters, startDate as unknown as string, endDate as unknown as string, sortBy as string, limit as number, tenantId);
          break;
        case 'financial':
          result = await generateFinancialReport(filters, startDate as unknown as string, endDate as unknown as string, sortBy as string, limit as number, tenantId);
          break;
        case 'operations':
          result = await generateOperationsReport(filters, startDate as unknown as string, endDate as unknown as string, limit as number, tenantId);
          break;
        default:
          return rep.code(400).send({ message: "Tipo de relatório não suportado" });
      }

      return rep.send({
        ...result,
        filters: { reportType, filters, startDate, endDate, groupBy, sortBy, limit },
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao gerar relatório personalizado:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.get("/reports/export/:format", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const { format } = z.object({
        format: z.enum(["csv", "pdf", "excel"]),
      }).parse(req.params);
      const { reportType, ...filters } = z.object({
        reportType: z.enum(["employees", "financial", "operations"]),
        startDate: z.coerce.date().optional(),
        endDate: z.string().optional(),
        limit: z.coerce.number().optional(),
      }).parse(req.query);

      let reportData: any = {};

      switch (reportType) {
        case 'employees':
          reportData = await generateEmployeeReport(filters, filters.startDate as unknown as string, filters.endDate as unknown as string, '', filters.limit as number, tenantId);
          break;
        case 'operations':
          reportData = await generateOperationsReport(filters, filters.startDate as unknown as string, filters.endDate as unknown as string, filters.limit as number, tenantId);
          break;
        default:
          return rep.code(400).send({ message: "Tipo de relatório não suportado" });
      }

      return rep.send({
        message: `Relatório ${reportType} preparado para exportação em ${format.toUpperCase()}`,
        data: reportData.data || reportData,
        format,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao exportar relatório:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });
}

async function generateEmployeeReport(filters: any, startDate: string, endDate: string, sortBy: string, limit: number, tenantId: number) {
  const whereClause: any = { tenantId };

  if (filters?.status && filters.status !== 'todos') {
    whereClause.status = filters.status;
  }

  if (startDate && endDate) {
    whereClause.hireDate = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  const employees = await prisma.employee.findMany({
    where: whereClause,
    orderBy: { [sortBy || 'name']: 'asc' },
    take: limit || undefined
  });

  return {
    data: employees,
    summary: {
      total: employees.length,
      byStatus: employees.reduce((acc, emp) => {
        acc[emp.status] = (acc[emp.status] || 0) + 1;
        return acc;
      }, {} as any)
    }
  };
}

async function generateFinancialReport(filters: any, startDate: string, endDate: string, sortBy: string, limit: number, tenantId: number) {
  const whereClause: any = { Employee: { tenantId } };

  if (filters?.type && filters.type !== 'todos') {
    whereClause.type = filters.type;
  }

  if (startDate && endDate) {
    whereClause.date = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    orderBy: { [sortBy || 'date']: 'desc' },
    take: limit || undefined
  });

  return {
    data: transactions,
    summary: {
      total: transactions.length,
      totalAmount: transactions.reduce((sum, t) => sum + (t.amount || 0), 0)
    }
  };
}

async function generateOperationsReport(filters: any, startDate: string, endDate: string, limit: number, tenantId: number) {
  const dateFilter = startDate && endDate ? {
    date: { gte: new Date(startDate), lte: new Date(endDate) }
  } : {};

  const [loads, maintenance, trips] = await Promise.all([
    prisma.load.findMany({ where: { tenantId, ...dateFilter }, take: limit || undefined }),
    prisma.maintenance.findMany({ where: { Truck: { tenantId }, ...dateFilter }, take: limit || undefined }),
    prisma.trip.findMany({ where: { tenantId, ...dateFilter }, take: limit || undefined }),
  ]);

  return {
    data: { loads, maintenance, trips },
    summary: {
      totalLoads: loads.length,
      totalMaintenance: maintenance.length,
      totalTrips: trips.length
    }
  };
}

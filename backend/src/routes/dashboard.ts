import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middlewares/authMiddleware";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/dashboard", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;

      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalEmployees, activeEmployees, inactiveEmployees,
        totalCompanies, activeCompanies,
        totalLoads, totalTrucks,
        totalTrips, activeTrips,
        employees,
        maintenanceCostAgg,
        financialEntries,
        maintenance6m,
        financial6m,
      ] = await Promise.all([
        prisma.employee.count({ where: { tenantId } }),
        prisma.employee.count({ where: { tenantId, status: "Ativo" } }),
        prisma.employee.count({ where: { tenantId, status: "Inativo" } }),
        prisma.company.count({ where: { tenantId } }),
        prisma.company.count({ where: { tenantId, status: "Ativo" } }),
        prisma.load.count({ where: { tenantId } }),
        prisma.truck.count({ where: { tenantId } }),
        prisma.trip.count({ where: { tenantId } }),
        prisma.trip.count({ where: { tenantId, status: "em_andamento" } }),
        prisma.employee.findMany({ where: { tenantId, status: "Ativo" }, select: { baseSalary: true } }),
        prisma.maintenance.aggregate({
          where: { Truck: { tenantId }, date: { gte: thirtyDaysAgo } },
          _sum: { value: true },
        }),
        prisma.financialEntry.findMany({
          where: { tenantId },
          select: { type: true, amount: true },
        }),
        prisma.maintenance.findMany({
          where: { Truck: { tenantId }, date: { gte: sixMonthsAgo } },
          select: { date: true, value: true },
        }),
        prisma.financialEntry.findMany({
          where: { tenantId, date: { gte: sixMonthsAgo } },
          select: { date: true, amount: true, type: true },
        }),
      ]);

      const totalSalaries = employees.reduce((sum, emp) => sum + emp.baseSalary, 0);
      const maintenanceCost = maintenanceCostAgg._sum.value ?? 0;

      const totalCredits = financialEntries
        .filter((e) => e.type === "entrada")
        .reduce((s, e) => s + e.amount, 0);
      const totalDebits = financialEntries
        .filter((e) => e.type === "saida" || e.type === "imposto")
        .reduce((s, e) => s + e.amount, 0);
      const balance = totalCredits - totalDebits;

      // Build last-6-months chart data
      const monthlyData = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();

        const maintenanceTotal = maintenance6m
          .filter((r) => {
            const rd = new Date(r.date);
            return rd.getFullYear() === y && rd.getMonth() === m;
          })
          .reduce((s, r) => s + (r.value ?? 0), 0);

        const creditsTotal = financial6m
          .filter((r) => {
            const rd = new Date(r.date);
            return rd.getFullYear() === y && rd.getMonth() === m && r.type === "entrada";
          })
          .reduce((s, r) => s + r.amount, 0);

        const debitsTotal = financial6m
          .filter((r) => {
            const rd = new Date(r.date);
            return rd.getFullYear() === y && rd.getMonth() === m && (r.type === "saida" || r.type === "imposto");
          })
          .reduce((s, r) => s + r.amount, 0);

        return {
          name: MONTH_NAMES[m],
          maintenance: Number(maintenanceTotal.toFixed(2)),
          credits: Number(creditsTotal.toFixed(2)),
          debits: Number(debitsTotal.toFixed(2)),
        };
      });

      return rep.send({
        summary: {
          totalEmployees, activeEmployees, inactiveEmployees, totalSalaries,
          totalCompanies, activeCompanies, totalLoads, totalTrucks,
          totalTrips, activeTrips,
          maintenanceCost, totalCredits, totalDebits, balance,
        },
        charts: {
          monthlyData,
          employeeStatusData: [
            { name: "Ativos", value: activeEmployees, color: "#52c41a" },
            { name: "Inativos", value: inactiveEmployees, color: "#ff4d4f" },
          ],
          companyStatusData: [
            { name: "Ativas", value: activeCompanies, color: "#1890ff" },
            { name: "Inativas", value: totalCompanies - activeCompanies, color: "#faad14" },
          ],
        },
      });
    } catch (error) {
      console.error("Erro no dashboard:", error);
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });

  app.get("/dashboard/quick-stats", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const [totalEmployees, activeEmployees, totalCompanies, totalLoads, totalTrucks] = await Promise.all([
        prisma.employee.count({ where: { tenantId } }),
        prisma.employee.count({ where: { tenantId, status: "Ativo" } }),
        prisma.company.count({ where: { tenantId } }),
        prisma.load.count({ where: { tenantId } }),
        prisma.truck.count({ where: { tenantId } }),
      ]);
      return rep.send({ totalEmployees, activeEmployees, totalCompanies, totalLoads, totalTrucks });
    } catch (error) {
      return rep.code(500).send({ message: "Erro interno do servidor" });
    }
  });
}

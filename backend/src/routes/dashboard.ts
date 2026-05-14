import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middlewares/authMiddleware";

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/dashboard", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;

      const [totalEmployees, activeEmployees, inactiveEmployees, totalCompanies, activeCompanies, totalLoads, totalTrucks] =
        await Promise.all([
          prisma.employee.count({ where: { tenantId } }),
          prisma.employee.count({ where: { tenantId, status: "Ativo" } }),
          prisma.employee.count({ where: { tenantId, status: "Inativo" } }),
          prisma.company.count({ where: { tenantId } }),
          prisma.company.count({ where: { tenantId, status: "Ativo" } }),
          prisma.load.count({ where: { tenantId } }),
          prisma.truck.count({ where: { tenantId } }),
        ]);

      const employees = await prisma.employee.findMany({
        where: { tenantId, status: "Ativo" },
        select: { baseSalary: true },
      });
      const totalSalaries = employees.reduce((sum, emp) => sum + emp.baseSalary, 0);

      const monthlyData = [
        { name: "Jan", maintenance: 0, transactions: 0 },
        { name: "Fev", maintenance: 0, transactions: 0 },
        { name: "Mar", maintenance: 0, transactions: 0 },
        { name: "Abr", maintenance: 0, transactions: 0 },
        { name: "Mai", maintenance: 0, transactions: 0 },
        { name: "Jun", maintenance: 0, transactions: 0 },
      ];

      return rep.send({
        summary: {
          totalEmployees, activeEmployees, inactiveEmployees, totalSalaries,
          totalCompanies, activeCompanies, totalLoads, totalTrucks,
          maintenanceCost: 0, totalCredits: 0, totalDebits: 0, balance: 0,
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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRoutes = dashboardRoutes;
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middlewares/authMiddleware");
async function dashboardRoutes(app) {
    app.addHook("preHandler", authMiddleware_1.authMiddleware);
    // Dashboard geral com estatísticas do sistema
    app.get("/dashboard", async (req, rep) => {
        try {
            // Contar funcionários
            const totalEmployees = await prisma_1.prisma.employee.count();
            const activeEmployees = await prisma_1.prisma.employee.count({
                where: { status: "Ativo" }
            });
            const inactiveEmployees = await prisma_1.prisma.employee.count({
                where: { status: "Inativo" }
            });
            // Calcular total de salários
            const employees = await prisma_1.prisma.employee.findMany({
                where: { status: "Ativo" },
                select: { baseSalary: true }
            });
            const totalSalaries = employees.reduce((sum, emp) => sum + emp.baseSalary, 0);
            // Contar empresas
            const totalCompanies = await prisma_1.prisma.company.count();
            const activeCompanies = await prisma_1.prisma.company.count({
                where: { status: "Ativo" }
            });
            // Contar cargas
            const totalLoads = await prisma_1.prisma.load.count();
            // Contar caminhões
            const totalTrucks = await prisma_1.prisma.truck.count();
            const employeeStatusData = [
                { name: 'Ativos', value: activeEmployees, color: '#52c41a' },
                { name: 'Inativos', value: inactiveEmployees, color: '#ff4d4f' }
            ];
            const companyStatusData = [
                { name: 'Ativas', value: activeCompanies, color: '#1890ff' },
                { name: 'Inativas', value: totalCompanies - activeCompanies, color: '#faad14' }
            ];
            // Dados mensais simulados para evitar problemas
            const monthlyData = [
                { name: 'Jan', maintenance: 1200, transactions: 5000 },
                { name: 'Fev', maintenance: 1800, transactions: 6000 },
                { name: 'Mar', maintenance: 900, transactions: 4500 },
                { name: 'Abr', maintenance: 1500, transactions: 7000 },
                { name: 'Mai', maintenance: 2000, transactions: 8000 },
                { name: 'Jun', maintenance: 1600, transactions: 7500 }
            ];
            return rep.send({
                summary: {
                    totalEmployees,
                    activeEmployees,
                    inactiveEmployees,
                    totalSalaries,
                    totalCompanies,
                    activeCompanies,
                    totalLoads,
                    totalTrucks,
                    maintenanceCost: 0, // Valor fixo para evitar problemas
                    totalCredits: 0, // Valor fixo para evitar problemas
                    totalDebits: 0, // Valor fixo para evitar problemas
                    balance: 0 // Valor fixo para evitar problemas
                },
                charts: {
                    monthlyData,
                    employeeStatusData,
                    companyStatusData
                }
            });
        }
        catch (error) {
            console.error("Erro ao buscar dados do dashboard:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Estatísticas rápidas
    app.get("/dashboard/quick-stats", async (req, rep) => {
        try {
            const [totalEmployees, activeEmployees, totalCompanies, totalLoads, totalTrucks] = await Promise.all([
                prisma_1.prisma.employee.count(),
                prisma_1.prisma.employee.count({ where: { status: "Ativo" } }),
                prisma_1.prisma.company.count(),
                prisma_1.prisma.load.count(),
                prisma_1.prisma.truck.count()
            ]);
            return rep.send({
                totalEmployees,
                activeEmployees,
                totalCompanies,
                totalLoads,
                totalTrucks
            });
        }
        catch (error) {
            console.error("Erro ao buscar estatísticas rápidas:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
}

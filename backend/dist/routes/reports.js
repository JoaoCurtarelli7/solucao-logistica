"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRoutes = void 0;
const prisma_1 = require("../lib/prisma");
const zod_1 = require("zod");
async function reportRoutes(app) {
    // Autenticação desativada temporariamente para facilitar testes
    // app.addHook("preHandler", authenticate);
    // Relatório geral do sistema
    app.get("/reports/system-overview", async (req, rep) => {
        try {
            const [totalEmployees, activeEmployees, totalCompanies, activeCompanies, totalLoads, totalTrucks, totalMaintenance, totalTransactions] = await Promise.all([
                prisma_1.prisma.employee.count(),
                prisma_1.prisma.employee.count({ where: { status: "Ativo" } }),
                prisma_1.prisma.company.count(),
                prisma_1.prisma.company.count({ where: { status: "Ativo" } }),
                prisma_1.prisma.load.count(),
                prisma_1.prisma.truck.count(),
                prisma_1.prisma.maintenance.count(),
                prisma_1.prisma.transaction.count()
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
        }
        catch (error) {
            console.error("Erro ao gerar relatório geral:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Relatório de funcionários
    app.get("/reports/employees", async (req, rep) => {
        try {
            const { status, startDate, endDate } = zod_1.z.object({
                status: zod_1.z.enum(["Ativo", "Inativo"]).optional(),
                startDate: zod_1.z.coerce.date().optional(),
                endDate: zod_1.z.string().optional(),
            }).parse(req.query);
            let whereClause = {};
            if (status && status !== 'Ativo') {
                whereClause.status = status;
            }
            if (startDate && endDate) {
                whereClause.hireDate = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            const employees = await prisma_1.prisma.employee.findMany({
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
        }
        catch (error) {
            console.error("Erro ao gerar relatório de funcionários:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Relatório de empresas
    app.get("/reports/companies", async (req, rep) => {
        try {
            const { status, startDate, endDate } = zod_1.z.object({
                status: zod_1.z.enum(["Ativo", "Inativo"]).optional(),
                startDate: zod_1.z.coerce.date().optional(),
                endDate: zod_1.z.string().optional(),
            }).parse(req.query);
            let whereClause = {};
            if (status && status !== 'Ativo') {
                whereClause.status = status;
            }
            if (startDate && endDate) {
                whereClause.dateRegistration = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            const companies = await prisma_1.prisma.company.findMany({
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
        }
        catch (error) {
            console.error("Erro ao gerar relatório de empresas:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Relatório de cargas
    app.get("/reports/loads", async (req, rep) => {
        try {
            const { status, startDate, endDate, companyId } = zod_1.z.object({
                status: zod_1.z.enum(["Ativo", "Inativo"]).optional(),
                startDate: zod_1.z.coerce.date().optional(),
                endDate: zod_1.z.string().optional(),
                companyId: zod_1.z.coerce.number().optional(),
            }).parse(req.query);
            let whereClause = {};
            if (status && status !== 'Ativo') {
                whereClause.status = status;
            }
            if (companyId) {
                whereClause.companyId = companyId;
            }
            if (startDate && endDate) {
                whereClause.createdAt = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            const loads = await prisma_1.prisma.load.findMany({
                where: whereClause,
                include: {
                    Company: true
                },
                orderBy: { date: 'desc' }
            });
            const totalValue = loads.reduce((sum, load) => sum + (load.totalValue || 0), 0);
            return rep.send({
                loads,
                summary: {
                    total: loads.length,
                    totalValue,
                    byStatus: loads.reduce((acc, load) => {
                        const status = load.status ?? load.Company?.status;
                        if (status) {
                            acc[status] = (acc[status] || 0) + 1;
                        }
                        return acc;
                    }, {})
                },
                filters: { status, startDate, endDate, companyId },
                generatedAt: new Date().toISOString()
            });
        }
        catch (error) {
            console.error("Erro ao gerar relatório de cargas:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Relatório de manutenções
    app.get("/reports/maintenance", async (req, rep) => {
        try {
            const { startDate, endDate, truckId } = zod_1.z.object({
                startDate: zod_1.z.coerce.date().optional(),
                endDate: zod_1.z.string().optional(),
                truckId: zod_1.z.coerce.number().optional(),
            }).parse(req.query);
            let whereClause = {};
            if (truckId) {
                whereClause.truckId = parseInt(truckId);
            }
            if (startDate && endDate) {
                whereClause.date = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            const maintenance = await prisma_1.prisma.maintenance.findMany({
                where: whereClause,
                include: {
                    Truck: {
                        select: {
                            id: true,
                            name: true,
                            plate: true
                        }
                    }
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
        }
        catch (error) {
            console.error("Erro ao gerar relatório de manutenções:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Relatório financeiro
    app.get("/reports/financial", async (req, rep) => {
        try {
            const { startDate, endDate, type } = zod_1.z.object({
                startDate: zod_1.z.coerce.date().optional(),
                endDate: zod_1.z.string().optional(),
                type: zod_1.z.enum(["Crédito", "Débito"]).optional(),
            }).parse(req.query);
            let whereClause = {};
            if (type) {
                whereClause.type = type;
            }
            if (startDate && endDate) {
                whereClause.date = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            const transactions = await prisma_1.prisma.transaction.findMany({
                where: whereClause,
                include: {
                    Employee: true
                },
                orderBy: { date: 'desc' }
            });
            const totalCredits = transactions
                .filter(t => t.type === 'Crédito')
                .reduce((sum, t) => sum + (t.amount || 0), 0);
            const totalDebits = transactions
                .filter(t => t.type === 'Débito')
                .reduce((sum, t) => sum + (t.amount || 0), 0);
            const balance = totalCredits - totalDebits;
            return rep.send({
                transactions,
                summary: {
                    total: transactions.length,
                    totalCredits,
                    totalDebits,
                    balance,
                    byType: transactions.reduce((acc, t) => {
                        acc[t.type] = (acc[t.type] || 0) + 1;
                        return acc;
                    }, {})
                },
                filters: { startDate, endDate, type },
                generatedAt: new Date().toISOString()
            });
        }
        catch (error) {
            console.error("Erro ao gerar relatório financeiro:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Relatório de viagens
    app.get("/reports/trips", async (req, rep) => {
        try {
            const { startDate, endDate, truckId, status } = zod_1.z.object({
                startDate: zod_1.z.coerce.date().optional(),
                endDate: zod_1.z.string().optional(),
                truckId: zod_1.z.coerce.number().optional(),
                status: zod_1.z.enum(["em_andamento", "finalizado"]).optional(),
            }).parse(req.query);
            let whereClause = {};
            if (status) {
                whereClause.status = status;
            }
            if (truckId) {
                whereClause.truckId = parseInt(truckId);
            }
            if (startDate && endDate) {
                whereClause.date = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            const trips = await prisma_1.prisma.trip.findMany({
                where: whereClause,
                include: {
                    Truck: {
                        select: {
                            id: true,
                            name: true,
                            plate: true
                        }
                    },
                    TripExpense: {
                        orderBy: { date: 'desc' }
                    }
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
                    }, {})
                },
                filters: { startDate, endDate, truckId, status },
                generatedAt: new Date().toISOString()
            });
        }
        catch (error) {
            console.error("Erro ao gerar relatório de viagens:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Relatório personalizado com múltiplos filtros
    app.post("/reports/custom", async (req, rep) => {
        try {
            const { reportType, filters, startDate, endDate, groupBy, sortBy, limit } = zod_1.z.object({
                reportType: zod_1.z.enum(["employees", "financial", "operations"]),
                filters: zod_1.z.any().optional(),
                startDate: zod_1.z.coerce.date().optional(),
                endDate: zod_1.z.string().optional(),
                groupBy: zod_1.z.string().optional(),
                sortBy: zod_1.z.string().optional(),
                limit: zod_1.z.coerce.number().optional(),
            }).parse(req.body);
            let result = {};
            switch (reportType) {
                case 'employees':
                    result = await generateEmployeeReport(filters, startDate, endDate, groupBy, sortBy, limit);
                    break;
                case 'financial':
                    result = await generateFinancialReport(filters, startDate, endDate, groupBy, sortBy, limit);
                    break;
                case 'operations':
                    result = await generateOperationsReport(filters, startDate, endDate, groupBy, sortBy, limit);
                    break;
                default:
                    return rep.code(400).send({ message: "Tipo de relatório não suportado" });
            }
            return rep.send({
                ...result,
                filters: { reportType, filters, startDate, endDate, groupBy, sortBy, limit },
                generatedAt: new Date().toISOString()
            });
        }
        catch (error) {
            console.error("Erro ao gerar relatório personalizado:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Exportar relatório em diferentes formatos
    app.get("/reports/export/:format", async (req, rep) => {
        try {
            const { format } = zod_1.z.object({
                format: zod_1.z.enum(["csv", "pdf", "excel"]),
            }).parse(req.params);
            const { reportType, ...filters } = zod_1.z.object({
                reportType: zod_1.z.enum(["employees", "financial", "operations"]),
                filters: zod_1.z.any().optional(),
                startDate: zod_1.z.coerce.date().optional(),
                endDate: zod_1.z.string().optional(),
                groupBy: zod_1.z.string().optional(),
                sortBy: zod_1.z.string().optional(),
                limit: zod_1.z.coerce.number().optional(),
            }).parse(req.query);
            if (!['csv', 'pdf', 'excel'].includes(format)) {
                return rep.code(400).send({ message: "Formato não suportado" });
            }
            let reportData = {};
            // Gerar dados baseado no tipo de relatório
            switch (reportType) {
                case 'employees':
                    reportData = await generateEmployeeReport(filters, filters.startDate, filters.endDate, '', '', 0);
                    break;
                case 'operations':
                    reportData = await generateOperationsReport(filters, filters.startDate, filters.endDate, '', '', 0);
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
        }
        catch (error) {
            console.error("Erro ao exportar relatório:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
}
exports.reportRoutes = reportRoutes;
// Funções auxiliares para relatórios
async function generateEmployeeReport(filters, startDate, endDate, groupBy, sortBy, limit) {
    let whereClause = {};
    if (filters?.status && filters.status !== 'todos') {
        whereClause.status = filters.status;
    }
    if (startDate && endDate) {
        whereClause.hireDate = {
            gte: new Date(startDate),
            lte: new Date(endDate)
        };
    }
    const employees = await prisma_1.prisma.employee.findMany({
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
            }, {})
        }
    };
}
async function generateFinancialReport(filters, startDate, endDate, groupBy, sortBy, limit) {
    let whereClause = {};
    if (filters?.type && filters.type !== 'todos') {
        whereClause.type = filters.type;
    }
    if (startDate && endDate) {
        whereClause.date = {
            gte: new Date(startDate),
            lte: new Date(endDate)
        };
    }
    const transactions = await prisma_1.prisma.transaction.findMany({
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
async function generateOperationsReport(filters, startDate, endDate, groupBy, sortBy, limit) {
    const [loads, maintenance, trips] = await Promise.all([
        prisma_1.prisma.load.findMany({
            where: startDate && endDate ? {
                date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            } : {},
            take: limit || undefined
        }),
        prisma_1.prisma.maintenance.findMany({
            where: startDate && endDate ? {
                date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            } : {},
            take: limit || undefined
        }),
        prisma_1.prisma.trip.findMany({
            where: startDate && endDate ? {
                date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            } : {},
            take: limit || undefined
        })
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
async function generateReportData(reportType, filters) {
    // Implementar geração de dados para exportação
    return { message: "Função de exportação em desenvolvimento" };
}
// Função auxiliar para construir cláusula WHERE
function buildWhereClause(filters) {
    let whereClause = {};
    if (filters?.status && filters.status !== 'todos') {
        whereClause.status = filters.status;
    }
    if (filters?.type && filters.type !== 'todos') {
        whereClause.type = filters.type;
    }
    if (filters?.companyId && filters.companyId !== 'todos') {
        whereClause.companyId = parseInt(filters.companyId);
    }
    if (filters?.truckId && filters.truckId !== 'todos') {
        whereClause.truckId = parseInt(filters.truckId);
    }
    if (filters?.startDate && filters?.endDate) {
        const dateField = filters.reportType === 'employees' ? 'hireDate' :
            filters.reportType === 'financial' ? 'date' :
                filters.reportType === 'maintenance' ? 'date' :
                    filters.reportType === 'trips' ? 'startDate' : 'createdAt';
        whereClause[dateField] = {
            gte: new Date(filters.startDate),
            lte: new Date(filters.endDate)
        };
    }
    return whereClause;
}

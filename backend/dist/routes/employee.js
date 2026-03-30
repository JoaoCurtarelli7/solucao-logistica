"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeeRoutes = employeeRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middlewares/authMiddleware");
function parseMaybeBrDate(str) {
    if (!str)
        return null;
    const s = String(str).trim();
    if (!s)
        return null;
    // aceita DD/MM/YYYY ou YYYY-MM-DDTHH:mm...
    if (s.includes("/")) {
        const [day, month, year] = s.split("/");
        return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return new Date(s);
}
async function employeeRoutes(app) {
    const paramsSchema = zod_1.z.object({
        id: zod_1.z.coerce.number(),
    });
    const employeeDetailsQuerySchema = zod_1.z.object({
        month: zod_1.z.coerce.number().min(1).max(12).optional(),
        year: zod_1.z.coerce.number().min(2000).max(3000).optional(),
    });
    const bodySchema = zod_1.z.object({
        name: zod_1.z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        role: zod_1.z.string().min(2, "Cargo deve ter pelo menos 2 caracteres"),
        baseSalary: zod_1.z.coerce.number().min(0, "Salário deve ser maior que zero"),
        status: zod_1.z.enum(["Ativo", "Inativo"]),
        pixAccount: zod_1.z.string().optional().or(zod_1.z.literal("")),
        cpf: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().email("Email inválido").optional().or(zod_1.z.literal("")),
        address: zod_1.z.string().optional(),
        hireDate: zod_1.z.string().optional().transform(parseMaybeBrDate),
    });
    app.addHook("preHandler", authMiddleware_1.authMiddleware);
    // LISTAR
    app.get("/employees", async (_req, rep) => {
        try {
            const employees = await prisma_1.prisma.employee.findMany({
                select: {
                    id: true,
                    name: true,
                    role: true,
                    baseSalary: true,
                    status: true,
                    pixAccount: true,
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
        }
        catch (error) {
            console.error("Erro ao buscar funcionários:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // OBTER POR ID
    app.get("/employees/:id", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            const { month, year } = employeeDetailsQuerySchema.parse(req.query);
            const employee = await prisma_1.prisma.employee.findUnique({
                where: { id },
                include: {
                    Transaction: { orderBy: { date: "desc" } }, // relação conforme seu schema
                },
            });
            if (!employee) {
                return rep.code(404).send({ message: "Funcionário não encontrado" });
            }
            const selectedYear = year ?? new Date().getFullYear();
            const selectedMonth = month ?? new Date().getMonth() + 1;
            const transactions = (employee.Transaction ?? []).filter((transaction) => {
                const transactionDate = new Date(transaction.date);
                return (transactionDate.getFullYear() === selectedYear &&
                    transactionDate.getMonth() + 1 === selectedMonth);
            });
            const monthlyMap = new Map();
            for (const transaction of employee.Transaction ?? []) {
                const transactionDate = new Date(transaction.date);
                const txYear = transactionDate.getFullYear();
                const txMonth = transactionDate.getMonth() + 1;
                const key = `${txYear}-${txMonth}`;
                const current = monthlyMap.get(key) ?? {
                    year: txYear,
                    month: txMonth,
                    totalCredits: 0,
                    totalDebits: 0,
                    transactionCount: 0,
                };
                if (transaction.type === "Crédito")
                    current.totalCredits += transaction.amount;
                if (transaction.type === "Débito")
                    current.totalDebits += transaction.amount;
                current.transactionCount += 1;
                monthlyMap.set(key, current);
            }
            const monthlyHistory = Array.from(monthlyMap.values())
                .map((item) => ({
                ...item,
                salaryTotalBalance: employee.baseSalary + item.totalCredits - item.totalDebits,
            }))
                .sort((a, b) => (b.year - a.year) || (b.month - a.month));
            const totalCredits = transactions
                .filter((transaction) => transaction.type === "Crédito")
                .reduce((sum, transaction) => sum + transaction.amount, 0);
            const totalDebits = transactions
                .filter((transaction) => transaction.type === "Débito")
                .reduce((sum, transaction) => sum + transaction.amount, 0);
            const salaryTotalBalance = employee.baseSalary + totalCredits - totalDebits;
            return rep.send({
                ...employee,
                financialSummary: {
                    totalCredits,
                    totalDebits,
                    transactionCount: transactions.length,
                    salaryTotalBalance,
                    selectedMonth,
                    selectedYear,
                },
                monthlyHistory,
                Transaction: transactions,
            });
        }
        catch (error) {
            console.error("Erro ao buscar funcionário:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // CRIAR
    app.post("/employees", async (req, rep) => {
        try {
            const data = bodySchema.parse(req.body);
            // CPF duplicado? (se fornecer CPF e não for vazio)
            if (data.cpf && data.cpf.trim() !== "") {
                const exists = await prisma_1.prisma.employee.findFirst({
                    where: { cpf: data.cpf },
                    select: { id: true },
                });
                if (exists) {
                    return rep.code(400).send({ message: "CPF já cadastrado" });
                }
            }
            const hireDate = data.hireDate ?? new Date();
            const employee = await prisma_1.prisma.employee.create({
                data: {
                    name: data.name,
                    role: data.role,
                    baseSalary: data.baseSalary,
                    status: data.status,
                    pixAccount: data.pixAccount && data.pixAccount.trim() !== "" ? data.pixAccount.trim() : null,
                    cpf: data.cpf && data.cpf.trim() !== "" ? data.cpf : null,
                    phone: data.phone && data.phone.trim() !== "" ? data.phone : null,
                    email: data.email && data.email.trim() !== "" ? data.email : null,
                    address: data.address && data.address.trim() !== "" ? data.address : null,
                    hireDate,
                    // createdAt/updatedAt seguem defaults do banco/schema
                },
            });
            return rep.code(201).send(employee);
        }
        catch (error) {
            console.error("Erro ao criar funcionário:", error);
            if (error instanceof zod_1.z.ZodError) {
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
    app.put("/employees/:id", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            const data = bodySchema.parse(req.body);
            const existing = await prisma_1.prisma.employee.findUnique({ where: { id } });
            if (!existing) {
                return rep.code(404).send({ message: "Funcionário não encontrado" });
            }
            // CPF duplicado em outro registro?
            if (data.cpf && data.cpf.trim() !== "" && data.cpf !== existing.cpf) {
                const duplicate = await prisma_1.prisma.employee.findFirst({
                    where: { cpf: data.cpf, NOT: { id } },
                    select: { id: true },
                });
                if (duplicate) {
                    return rep.code(400).send({ message: "CPF já cadastrado" });
                }
            }
            const hireDate = data.hireDate ?? existing.hireDate;
            const updated = await prisma_1.prisma.employee.update({
                where: { id },
                data: {
                    name: data.name,
                    role: data.role,
                    baseSalary: data.baseSalary,
                    status: data.status,
                    pixAccount: data.pixAccount && data.pixAccount.trim() !== "" ? data.pixAccount.trim() : null,
                    cpf: data.cpf && data.cpf.trim() !== "" ? data.cpf : null,
                    phone: data.phone && data.phone.trim() !== "" ? data.phone : null,
                    email: data.email && data.email.trim() !== "" ? data.email : null,
                    address: data.address && data.address.trim() !== "" ? data.address : null,
                    hireDate,
                    updatedAt: new Date(),
                },
            });
            return rep.send(updated);
        }
        catch (error) {
            console.error("Erro ao atualizar funcionário:", error);
            if (error instanceof zod_1.z.ZodError) {
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
    app.delete("/employees/:id", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            const existing = await prisma_1.prisma.employee.findUnique({ where: { id } });
            if (!existing) {
                return rep.code(404).send({ message: "Funcionário não encontrado" });
            }
            await prisma_1.prisma.employee.delete({ where: { id } });
            return rep.code(204).send();
        }
        catch (error) {
            console.error("Erro ao deletar funcionário:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // LISTAR TRANSAÇÕES DO FUNCIONÁRIO
    app.post("/employees/:id/transactions", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            const transactionSchema = zod_1.z.object({
                type: zod_1.z.enum(["Crédito", "Débito"]),
                amount: zod_1.z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
                description: zod_1.z.string().min(1, "Descrição da transação é obrigatória"),
                date: zod_1.z.string().optional(), // aceita ISO; se vier vazio, usa agora
            });
            const { type, amount, description, date } = transactionSchema.parse(req.body);
            // garante que o funcionário existe (evita criar "solto")
            await prisma_1.prisma.employee.findUniqueOrThrow({ where: { id } });
            const transactionDate = date ? new Date(date) : new Date();
            // ✅ cria já vinculado via relação (não usa employeeId direto)
            const transaction = await prisma_1.prisma.transaction.create({
                data: {
                    type,
                    amount,
                    date: transactionDate,
                    description,
                    Employee: { connect: { id } }, // <- este é o pulo do gato
                },
            });
            return rep.code(201).send(transaction);
        }
        catch (error) {
            if (error?.code === "P2025") {
                return rep.code(404).send({ message: "Funcionário não encontrado" });
            }
            console.error("Erro ao criar transação:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Listar transações do funcionário (opção 1: via relação)
    app.get("/employees/:id/transactions", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            const employee = await prisma_1.prisma.employee.findUnique({
                where: { id },
                include: {
                    Transaction: {
                        select: { id: true, type: true, amount: true, date: true, description: true },
                        orderBy: { date: "desc" },
                    },
                },
            });
            if (!employee) {
                return rep.code(404).send({ message: "Funcionário não encontrado" });
            }
            return rep.send(employee.Transaction);
        }
        catch (error) {
            console.error("Erro ao buscar transações:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Editar transação do funcionário
    app.put("/employees/:id/transactions/:transactionId", async (req, rep) => {
        try {
            const transactionParamsSchema = zod_1.z.object({
                id: zod_1.z.coerce.number(),
                transactionId: zod_1.z.coerce.number(),
            });
            const transactionBodySchema = zod_1.z.object({
                type: zod_1.z.enum(["Crédito", "Débito"]),
                amount: zod_1.z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
                description: zod_1.z.string().min(1, "Descrição da transação é obrigatória"),
                date: zod_1.z.string().optional(),
            });
            const { id, transactionId } = transactionParamsSchema.parse(req.params);
            const { type, amount, description, date } = transactionBodySchema.parse(req.body);
            const existing = await prisma_1.prisma.transaction.findUnique({
                where: { id: transactionId },
                select: { id: true, employeeId: true },
            });
            if (!existing || existing.employeeId !== id) {
                return rep.code(404).send({ message: "Transação não encontrada para este funcionário" });
            }
            const transactionDate = date ? new Date(date) : new Date();
            const updated = await prisma_1.prisma.transaction.update({
                where: { id: transactionId },
                data: {
                    type,
                    amount,
                    description,
                    date: transactionDate,
                },
            });
            return rep.send(updated);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return rep.code(400).send({
                    message: "Dados inválidos",
                    errors: error.errors.map((err) => ({
                        field: err.path.join("."),
                        message: err.message,
                    })),
                });
            }
            console.error("Erro ao editar transação:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // Remover transação do funcionário
    app.delete("/employees/:id/transactions/:transactionId", async (req, rep) => {
        try {
            const transactionParamsSchema = zod_1.z.object({
                id: zod_1.z.coerce.number(),
                transactionId: zod_1.z.coerce.number(),
            });
            const { id, transactionId } = transactionParamsSchema.parse(req.params);
            const existing = await prisma_1.prisma.transaction.findUnique({
                where: { id: transactionId },
                select: { id: true, employeeId: true },
            });
            if (!existing || existing.employeeId !== id) {
                return rep.code(404).send({ message: "Transação não encontrada para este funcionário" });
            }
            await prisma_1.prisma.transaction.delete({ where: { id: transactionId } });
            return rep.code(204).send();
        }
        catch (error) {
            console.error("Erro ao remover transação:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
    // BUSCA COM FILTROS
    app.get("/employees/search", async (req, rep) => {
        try {
            const querySchema = zod_1.z.object({
                name: zod_1.z.string().optional(),
                role: zod_1.z.string().optional(),
                status: zod_1.z.string().optional(),
            });
            const { name, role, status } = querySchema.parse(req.query);
            const where = {};
            if (name)
                where.name = { contains: name };
            if (role)
                where.role = { contains: role };
            if (status)
                where.status = status;
            const employees = await prisma_1.prisma.employee.findMany({
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
        }
        catch (error) {
            console.error("Erro na busca de funcionários:", error);
            return rep.code(500).send({ message: "Erro interno do servidor" });
        }
    });
}

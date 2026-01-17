"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.truckRoutes = truckRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middlewares/authMiddleware");
// Função auxiliar para converter datas (aceita DD/MM/YYYY ou YYYY-MM-DD)
function parseDateToDate(input) {
    if (!input)
        throw new Error("Data é obrigatória");
    if (input instanceof Date)
        return input;
    const str = String(input).trim();
    if (!str)
        throw new Error("Data é obrigatória");
    // DD/MM/YYYY
    if (str.includes("/")) {
        const [day, month, year] = str.split("/");
        const d = Number(day), m = Number(month), y = Number(year);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
            const date = new Date(y, m - 1, d);
            if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
                return date;
            }
        }
    }
    // YYYY-MM-DD ou ISO
    const maybe = new Date(str);
    if (!isNaN(maybe.getTime()))
        return maybe;
    throw new Error(`Formato de data inválido: ${str}. Use DD/MM/YYYY ou YYYY-MM-DD`);
}
async function truckRoutes(app) {
    const paramsSchema = zod_1.z.object({
        id: zod_1.z.coerce.number(),
    });
    const truckBodySchema = zod_1.z.object({
        name: zod_1.z.string().min(1, "Nome é obrigatório"),
        plate: zod_1.z.string().min(1, "Placa é obrigatória"),
        brand: zod_1.z.string().min(1, "Marca é obrigatória"),
        year: zod_1.z.coerce.number().min(1900, "Ano deve ser válido"),
        docExpiry: zod_1.z.union([zod_1.z.string(), zod_1.z.date()]).transform((val) => {
            if (val instanceof Date)
                return val;
            return parseDateToDate(val);
        }),
        renavam: zod_1.z.string().min(1, "Renavam é obrigatório"),
        image: zod_1.z.string().optional(),
    });
    const maintenanceBodySchema = zod_1.z.object({
        date: zod_1.z.string().transform((str) => new Date(str)),
        service: zod_1.z.string().min(1, "Serviço é obrigatório"),
        km: zod_1.z.coerce.number().min(0, "KM deve ser válido"),
        value: zod_1.z.coerce.number().min(0, "Valor deve ser válido"),
        notes: zod_1.z.string().optional(),
    });
    app.addHook("preHandler", authMiddleware_1.authenticate);
    // Listar todos os caminhões
    app.get("/trucks", async (req, rep) => {
        try {
            const trucks = await prisma_1.prisma.truck.findMany({
                include: {
                    Maintenance: {
                        orderBy: { date: 'desc' }
                    },
                    Trip: {
                        orderBy: { date: 'desc' },
                        include: {
                            TripExpense: true
                        }
                    }
                },
                orderBy: { name: 'asc' }
            });
            return { trucks };
        }
        catch (error) {
            console.error("Erro ao listar caminhões:", error);
            return rep.code(500).send({ message: "Erro ao listar caminhões" });
        }
    });
    // Buscar caminhão por id
    app.get("/trucks/:id", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            const truck = await prisma_1.prisma.truck.findUniqueOrThrow({
                where: { id },
                include: {
                    Maintenance: {
                        orderBy: { date: 'desc' }
                    },
                    Trip: {
                        orderBy: { date: 'desc' },
                        include: {
                            TripExpense: true
                        }
                    }
                },
            });
            return truck;
        }
        catch (error) {
            console.error("Erro ao buscar caminhão:", error);
            return rep.code(500).send({ message: "Erro ao buscar caminhão" });
        }
    });
    // Listar manutenções de um caminhão específico
    app.get("/trucks/:id/maintenances", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            const maintenances = await prisma_1.prisma.maintenance.findMany({
                where: { truckId: id },
                orderBy: { date: 'desc' }
            });
            return { maintenances };
        }
        catch (error) {
            console.error("Erro ao listar manutenções:", error);
            return rep.code(500).send({ message: "Erro ao listar manutenções do caminhão" });
        }
    });
    // Criar manutenção para um caminhão específico
    app.post("/trucks/:id/maintenances", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            const maintenanceData = maintenanceBodySchema.parse(req.body);
            // Verificar se o caminhão existe
            const truck = await prisma_1.prisma.truck.findUnique({
                where: { id }
            });
            if (!truck) {
                return rep.code(404).send({ message: "Caminhão não encontrado" });
            }
            const maintenance = await prisma_1.prisma.maintenance.create({
                data: {
                    date: maintenanceData.date,
                    service: maintenanceData.service,
                    km: maintenanceData.km,
                    value: maintenanceData.value,
                    notes: maintenanceData.notes,
                    truckId: id
                }
            });
            return rep.code(201).send(maintenance);
        }
        catch (error) {
            console.error("Erro ao criar manutenção:", error);
            return rep.code(500).send({ message: "Erro ao criar manutenção para o caminhão" });
        }
    });
    // Atualizar manutenção
    app.put("/maintenances/:id", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            const maintenanceData = maintenanceBodySchema.parse(req.body);
            const maintenance = await prisma_1.prisma.maintenance.update({
                where: { id },
                data: {
                    date: maintenanceData.date,
                    service: maintenanceData.service,
                    km: maintenanceData.km,
                    value: maintenanceData.value,
                    notes: maintenanceData.notes,
                }
            });
            return maintenance;
        }
        catch (error) {
            console.error("Erro ao atualizar manutenção:", error);
            return rep.code(500).send({ message: "Erro ao atualizar manutenção" });
        }
    });
    // Deletar manutenção
    app.delete("/maintenances/:id", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            await prisma_1.prisma.maintenance.delete({ where: { id } });
            return rep.code(204).send();
        }
        catch (error) {
            console.error("Erro ao deletar manutenção:", error);
            return rep.code(500).send({ message: "Erro ao deletar manutenção" });
        }
    });
    // Criar caminhão
    app.post("/trucks", async (req, rep) => {
        try {
            const data = truckBodySchema.parse(req.body);
            // Verificar se a placa já existe
            const existingTruck = await prisma_1.prisma.truck.findUnique({
                where: { plate: data.plate }
            });
            if (existingTruck) {
                return rep.code(400).send({ message: "Já existe um caminhão com esta placa" });
            }
            const truck = await prisma_1.prisma.truck.create({ data });
            return rep.code(201).send(truck);
        }
        catch (error) {
            console.error("Erro ao criar caminhão:", error);
            // Tratar erros de validação do Zod
            if (error instanceof zod_1.z.ZodError) {
                const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
                return rep.code(400).send({
                    message: "Erro de validação",
                    errors: error.errors,
                    details: errorMessages
                });
            }
            // Tratar erros do Prisma
            if (error && typeof error === 'object' && 'code' in error) {
                if (error.code === 'P2002') {
                    return rep.code(400).send({ message: "Já existe um caminhão com esta placa ou renavam" });
                }
            }
            return rep.code(500).send({ message: "Erro ao criar caminhão", error: error instanceof Error ? error.message : String(error) });
        }
    });
    // Atualizar caminhão
    app.put("/trucks/:id", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            const data = truckBodySchema.parse(req.body);
            // Verificar se a placa já existe em outro caminhão
            const existingTruck = await prisma_1.prisma.truck.findFirst({
                where: {
                    plate: data.plate,
                    id: { not: id }
                }
            });
            if (existingTruck) {
                return rep.code(400).send({ message: "Já existe um caminhão com esta placa" });
            }
            const truck = await prisma_1.prisma.truck.update({ where: { id }, data });
            return truck;
        }
        catch (error) {
            console.error("Erro ao atualizar caminhão:", error);
            // Tratar erros de validação do Zod
            if (error instanceof zod_1.z.ZodError) {
                const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
                return rep.code(400).send({
                    message: "Erro de validação",
                    errors: error.errors,
                    details: errorMessages
                });
            }
            // Tratar erros do Prisma
            if (error && typeof error === 'object' && 'code' in error) {
                if (error.code === 'P2025') {
                    return rep.code(404).send({ message: "Caminhão não encontrado" });
                }
                if (error.code === 'P2002') {
                    return rep.code(400).send({ message: "Já existe um caminhão com esta placa ou renavam" });
                }
            }
            return rep.code(500).send({ message: "Erro ao atualizar caminhão", error: error instanceof Error ? error.message : String(error) });
        }
    });
    // Deletar caminhão
    app.delete("/trucks/:id", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            // Verificar se o caminhão tem viagens ou manutenções
            const truck = await prisma_1.prisma.truck.findUnique({
                where: { id },
                include: {
                    Trip: true,
                    Maintenance: true
                }
            });
            if (!truck) {
                return rep.code(404).send({ message: "Caminhão não encontrado" });
            }
            if (truck.Trip.length > 0 || truck.Maintenance.length > 0) {
                return rep.code(400).send({
                    message: "Não é possível deletar um caminhão com viagens ou manutenções registradas"
                });
            }
            await prisma_1.prisma.truck.delete({ where: { id } });
            return rep.code(204).send();
        }
        catch (error) {
            console.error("Erro ao deletar caminhão:", error);
            return rep.code(500).send({ message: "Erro ao deletar caminhão" });
        }
    });
    // Buscar manutenção por ID
    app.get("/maintenances/:id", async (req, rep) => {
        try {
            const { id } = paramsSchema.parse(req.params);
            const maintenance = await prisma_1.prisma.maintenance.findUniqueOrThrow({
                where: { id },
                include: {
                    Truck: {
                        select: {
                            id: true,
                            name: true,
                            plate: true
                        }
                    }
                }
            });
            return maintenance;
        }
        catch (error) {
            console.error("Erro ao buscar manutenção:", error);
            return rep.code(500).send({ message: "Erro ao buscar manutenção" });
        }
    });
}

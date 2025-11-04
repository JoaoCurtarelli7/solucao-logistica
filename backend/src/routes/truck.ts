import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/authMiddleware";

export async function truckRoutes(app: FastifyInstance) {
  const paramsSchema = z.object({
    id: z.coerce.number(),
  });

  const truckBodySchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    plate: z.string().min(1, "Placa é obrigatória"),
    brand: z.string().min(1, "Marca é obrigatória"),
    year: z.coerce.number().min(1900, "Ano deve ser válido"),
    docExpiry: z.string().transform((str) => new Date(str)),
    renavam: z.string().min(1, "Renavam é obrigatório"),
    image: z.string().optional(),
  });

  const maintenanceBodySchema = z.object({
    date: z.string().transform((str) => new Date(str)),
    service: z.string().min(1, "Serviço é obrigatório"),
    km: z.coerce.number().min(0, "KM deve ser válido"),
    value: z.coerce.number().min(0, "Valor deve ser válido"),
    notes: z.string().optional(),
  });

  app.addHook("preHandler", authenticate);

  // Listar todos os caminhões
  app.get("/trucks", async (req, rep) => {
    try {
      const trucks = await prisma.truck.findMany({
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
    } catch (error) {
      console.error("Erro ao listar caminhões:", error);
      return rep.code(500).send({ message: "Erro ao listar caminhões" });
    }
  });

  // Buscar caminhão por id
  app.get("/trucks/:id", async (req, rep) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const truck = await prisma.truck.findUniqueOrThrow({
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
    } catch (error) {
      console.error("Erro ao buscar caminhão:", error);
    
      return rep.code(500).send({ message: "Erro ao buscar caminhão" });
    }
  });

  // Listar manutenções de um caminhão específico
  app.get("/trucks/:id/maintenances", async (req, rep) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const maintenances = await prisma.maintenance.findMany({
        where: { truckId: id },
        orderBy: { date: 'desc' }
      });
      return { maintenances };
    } catch (error) {
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
      const truck = await prisma.truck.findUnique({
        where: { id }
      });
      
      if (!truck) {
        return rep.code(404).send({ message: "Caminhão não encontrado" });
      }

      const maintenance = await prisma.maintenance.create({
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
    } catch (error) {
      console.error("Erro ao criar manutenção:", error);
      return rep.code(500).send({ message: "Erro ao criar manutenção para o caminhão" });
    }
  });

  // Atualizar manutenção
  app.put("/maintenances/:id", async (req, rep) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const maintenanceData = maintenanceBodySchema.parse(req.body);
      
      const maintenance = await prisma.maintenance.update({
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
    } catch (error) {
      console.error("Erro ao atualizar manutenção:", error);
      return rep.code(500).send({ message: "Erro ao atualizar manutenção" });
    }
  });

  // Deletar manutenção
  app.delete("/maintenances/:id", async (req, rep) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      await prisma.maintenance.delete({ where: { id } });
      return rep.code(204).send();
    } catch (error) {
      console.error("Erro ao deletar manutenção:", error);
      return rep.code(500).send({ message: "Erro ao deletar manutenção" });
    }
  });

  // Criar caminhão
  app.post("/trucks", async (req, rep) => {
    try {
      const data = truckBodySchema.parse(req.body);
      
      // Verificar se a placa já existe
      const existingTruck = await prisma.truck.findUnique({
        where: { plate: data.plate }
      });
      
      if (existingTruck) {
        return rep.code(400).send({ message: "Já existe um caminhão com esta placa" });
      }

      const truck = await prisma.truck.create({ data });
      return rep.code(201).send(truck);
    } catch (error) {
      console.error("Erro ao criar caminhão:", error);
      return rep.code(500).send({ message: "Erro ao criar caminhão" });
    }
  });

  // Atualizar caminhão
  app.put("/trucks/:id", async (req, rep) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const data = truckBodySchema.parse(req.body);

      // Verificar se a placa já existe em outro caminhão
      const existingTruck = await prisma.truck.findFirst({
        where: { 
          plate: data.plate,
          id: { not: id }
        }
      });
      
      if (existingTruck) {
        return rep.code(400).send({ message: "Já existe um caminhão com esta placa" });
      }

      const truck = await prisma.truck.update({ where: { id }, data });
      return truck;
    } catch (error) {
      console.error("Erro ao atualizar caminhão:", error);
      return rep.code(500).send({ message: "Erro ao atualizar caminhão" });
    }
  });

  // Deletar caminhão
  app.delete("/trucks/:id", async (req, rep) => {
    try {
      const { id } = paramsSchema.parse(req.params);

      // Verificar se o caminhão tem viagens ou manutenções
      const truck = await prisma.truck.findUnique({
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

      await prisma.truck.delete({ where: { id } });
      return rep.code(204).send();
    } catch (error) {
      console.error("Erro ao deletar caminhão:", error);
      return rep.code(500).send({ message: "Erro ao deletar caminhão" });
    }
  });

  // Buscar manutenção por ID
  app.get("/maintenances/:id", async (req, rep) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const maintenance = await prisma.maintenance.findUniqueOrThrow({
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
    } catch (error) {
      console.error("Erro ao buscar manutenção:", error);
     
      return rep.code(500).send({ message: "Erro ao buscar manutenção" });
    }
  });
}

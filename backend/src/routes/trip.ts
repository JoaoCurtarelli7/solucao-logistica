import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middlewares/authMiddleware";

export async function tripRoutes(app: FastifyInstance) {
  const paramsSchema = z.object({ id: z.coerce.number() });
  
  const tripBodySchema = z.object({
    destination: z.string().min(1, "Destino é obrigatório"),
    driver: z.string().min(1, "Motorista é obrigatório"),
    date: z.string().transform((str) => new Date(str)),
    freightValue: z.coerce.number().min(0, "Valor do frete deve ser válido"),
    truckId: z.coerce.number().optional(),
    status: z.enum(["em_andamento", "concluida", "cancelada"]).default("em_andamento"),
    notes: z.string().optional(),
  });

  app.addHook("preHandler", authMiddleware);

  // Listar todas as viagens
  app.get("/trips", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const trips = await prisma.trip.findMany({
        include: { 
          TripExpense: {
            orderBy: { date: 'desc' }
          },
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
      return { trips };
    } catch (error) {
      console.error("Erro ao listar viagens:", error);
      return rep.code(500).send({ message: "Erro ao listar viagens" });
    }
  });

  // Buscar viagem por ID
  app.get("/trips/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const trip = await prisma.trip.findUniqueOrThrow({
        where: { id },
        include: { 
          TripExpense: {
            orderBy: { date: 'desc' }
          },
          Truck: {
            select: {
              id: true,
              name: true,
              plate: true
            }
          } 
        }
      });
      return trip;
    } catch (error) {
      console.error("Erro ao buscar viagem:", error);
     
      return rep.code(500).send({ message: "Erro ao buscar viagem" });
    }
  });

  // Listar viagens de um caminhão específico
  app.get("/trucks/:truckId/trips", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { truckId } = z.object({ truckId: z.coerce.number() }).parse(req.params);
      const trips = await prisma.trip.findMany({
        where: { truckId },
        include: { 
          TripExpense: {
            orderBy: { date: 'desc' }
          },
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
      return { trips };
    } catch (error) {
      console.error("Erro ao listar viagens do caminhão:", error);
      return rep.code(500).send({ message: "Erro ao listar viagens do caminhão" });
    }
  });

  // Criar viagem
  app.post("/trips", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const data = tripBodySchema.parse(req.body);
      
      // Verificar se o caminhão existe (se fornecido)
      if (data.truckId) {
        const truck = await prisma.truck.findUnique({
          where: { id: data.truckId }
        });
        
        if (!truck) {
          return rep.code(400).send({ message: "Caminhão não encontrado" });
        }
      }

      const trip = await prisma.trip.create({
        data: {
          destination: data.destination,
          driver: data.driver,
          date: data.date,
          freightValue: data.freightValue,
          truckId: data.truckId,
          status: data.status,
          notes: data.notes,
        },
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
      
      return rep.code(201).send(trip);
    } catch (error) {
      console.error("Erro ao criar viagem:", error);
      return rep.code(500).send({ message: "Erro ao criar viagem" });
    }
  });

  // Atualizar viagem
  app.put("/trips/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const data = tripBodySchema.parse(req.body);

      // Verificar se a viagem existe
      const existingTrip = await prisma.trip.findUnique({
        where: { id }
      });
      
      if (!existingTrip) {
        return rep.code(404).send({ message: "Viagem não encontrada" });
      }

      // Verificar se o caminhão existe (se fornecido)
      if (data.truckId) {
        const truck = await prisma.truck.findUnique({
          where: { id: data.truckId }
        });
        
        if (!truck) {
          return rep.code(400).send({ message: "Caminhão não encontrado" });
        }
      }

      const trip = await prisma.trip.update({ 
        where: { id }, 
        data: {
          destination: data.destination,
          driver: data.driver,
          date: data.date,
          freightValue: data.freightValue,
          truckId: data.truckId,
          status: data.status,
          notes: data.notes,
        },
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
      
      return trip;
    } catch (error) {
      console.error("Erro ao atualizar viagem:", error);
      return rep.code(500).send({ message: "Erro ao atualizar viagem" });
    }
  });

  // Deletar viagem
  app.delete("/trips/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      
      // Verificar se a viagem existe
      const trip = await prisma.trip.findUnique({
        where: { id },
        include: {
          TripExpense: true
        }
      });
      
      if (!trip) {
        return rep.code(404).send({ message: "Viagem não encontrada" });
      }

      // Verificar se tem despesas
      if (trip.TripExpense.length > 0) {
        return rep.code(400).send({ 
          message: "Não é possível deletar uma viagem com despesas registradas" 
        });
      }

      await prisma.trip.delete({ where: { id } });
      return rep.code(204).send();
    } catch (error) {
      console.error("Erro ao deletar viagem:", error);
      return rep.code(500).send({ message: "Erro ao deletar viagem" });
    }
  });

  // Atualizar status da viagem
  app.patch("/trips/:id/status", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const { status } = z.object({
        status: z.enum(["em_andamento", "concluida", "cancelada"])
      }).parse(req.body);

      const trip = await prisma.trip.update({
        where: { id },
        data: { status },
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

      return trip;
    } catch (error) {
      console.error("Erro ao atualizar status da viagem:", error);
      return rep.code(500).send({ message: "Erro ao atualizar status da viagem" });
    }
  });

  // Resumo de viagens
  app.get("/trips/summary", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { startDate, endDate, truckId, status } = z.object({
        startDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
        endDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
        truckId: z.coerce.number().optional(),
        status: z.enum(["em_andamento", "concluida", "cancelada"]).optional(),
      }).parse(req.query);

      const where: any = {};
      
      if (startDate && endDate) {
        where.date = {
          gte: startDate,
          lte: endDate,
        };
      }
      
      if (truckId) {
        where.truckId = truckId;
      }
      
      if (status) {
        where.status = status;
      }

      const trips = await prisma.trip.findMany({ where });
      
      const totalTrips = trips.length;
      const totalFreight = trips.reduce((sum, trip) => sum + trip.freightValue, 0);
      const completedTrips = trips.filter(trip => trip.status === 'concluida').length;
      const inProgressTrips = trips.filter(trip => trip.status === 'em_andamento').length;
      const cancelledTrips = trips.filter(trip => trip.status === 'cancelada').length;

      return {
        summary: {
          totalTrips,
          totalFreight,
          completedTrips,
          inProgressTrips,
          cancelledTrips,
        },
        trips: trips.length
      };
    } catch (error) {
      console.error("Erro ao gerar resumo de viagens:", error);
      return rep.code(500).send({ message: "Erro ao gerar resumo de viagens" });
    }
  });
}

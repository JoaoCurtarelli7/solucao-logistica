import type { FastifyInstance, FastifyReply, FastifyRequest } from "../types/fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middlewares/authMiddleware";
import { paginationSchema, paginationMeta } from "../lib/paginate";

export async function tripRoutes(app: FastifyInstance) {
  const paramsSchema = z.object({ id: z.coerce.number() });
  
  const tripBodySchema = z.object({
    origin: z.union([z.string(), z.null()]).optional().transform((v) => v || null),
    destination: z.string().min(1, "Destino é obrigatório"),
    driver: z.string().min(1, "Motorista é obrigatório"),
    date: z.union([z.string(), z.date()]).transform((v) => (typeof v === 'string' ? new Date(v) : v)),
    estimatedArrival: z.union([z.string(), z.null()]).optional().transform((v) => (v && v !== '' ? new Date(v as string) : null)),
    freightValue: z.coerce.number().min(0, "Valor do frete deve ser válido"),
    truckId: z.coerce.number().optional().nullable(),
    status: z.enum(["em_andamento", "concluida", "cancelada"]).default("em_andamento"),
    notes: z.union([z.string(), z.null()]).optional().transform((v) => v || null),
  });

  app.addHook("preHandler", authMiddleware);

  // Listar viagens — suporta ?page=&limit=&search=&status=&truckId=
  app.get("/trips", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const tenantId = req.user!.tenantId;
      const query = paginationSchema.extend({
        status: z.enum(["em_andamento", "concluida", "cancelada"]).optional(),
        truckId: z.coerce.number().optional(),
      }).parse(req.query);
      const hasPagination = !!(req.query as Record<string, unknown>).page;

      const where = {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.truckId ? { truckId: query.truckId } : {}),
        ...(query.search
          ? {
              OR: [
                { driver: { contains: query.search, mode: "insensitive" as const } },
                { destination: { contains: query.search, mode: "insensitive" as const } },
                { origin: { contains: query.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const include = {
        TripExpense: { orderBy: { date: "desc" as const } },
        Truck: { select: { id: true, name: true, plate: true } },
      };

      if (!hasPagination) {
        const trips = await prisma.trip.findMany({ where, include, orderBy: { date: "desc" } });
        return { trips };
      }

      const [total, trips] = await prisma.$transaction([
        prisma.trip.count({ where }),
        prisma.trip.findMany({
          where, include, orderBy: { date: "desc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
      ]);
      return rep.send({ data: trips, ...paginationMeta(total, query.page, query.limit) });
    } catch (error) {
      console.error("Erro ao listar viagens:", error);
      return rep.code(500).send({ message: "Erro ao listar viagens" });
    }
  });

  // Buscar viagem por ID
  app.get("/trips/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const tenantId = req.user!.tenantId;
      const trip = await prisma.trip.findFirst({
        where: { id, tenantId },
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
      if (!trip) {
        return rep.code(404).send({ message: "Viagem não encontrada" });
      }
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
      const tenantId = req.user!.tenantId;
      const trips = await prisma.trip.findMany({
        where: { truckId, tenantId },
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
      const tenantId = req.user!.tenantId;

      // Verificar se o caminhão existe e pertence ao tenant (se fornecido)
      if (data.truckId) {
        const truck = await prisma.truck.findFirst({
          where: { id: data.truckId, tenantId }
        });

        if (!truck) {
          return rep.code(400).send({ message: "Caminhão não encontrado" });
        }
      }

      const trip = await prisma.trip.create({
        data: {
          origin: data.origin || null,
          destination: data.destination,
          driver: data.driver,
          date: data.date,
          estimatedArrival: data.estimatedArrival ?? null,
          freightValue: data.freightValue,
          truckId: data.truckId,
          status: data.status,
          notes: data.notes,
          tenantId,
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
    } catch (error: any) {
      console.error("Erro ao criar viagem:", error);
      const isPrismaSchemaError = error?.code === 'P2010' || error?.message?.includes('column') || error?.message?.includes('does not exist');
      const message = isPrismaSchemaError
        ? "Banco desatualizado. No terminal do backend execute: npx prisma migrate deploy"
        : (error?.message || "Erro ao criar viagem");
      return rep.code(500).send({ message });
    }
  });

  // Atualizar viagem
  app.put("/trips/:id", async (req: FastifyRequest, rep: FastifyReply) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const data = tripBodySchema.parse(req.body);
      const tenantId = req.user!.tenantId;

      // Verificar se a viagem existe e pertence ao tenant
      const existingTrip = await prisma.trip.findFirst({
        where: { id, tenantId }
      });

      if (!existingTrip) {
        return rep.code(404).send({ message: "Viagem não encontrada" });
      }

      // Verificar se o caminhão existe e pertence ao tenant (se fornecido)
      if (data.truckId) {
        const truck = await prisma.truck.findFirst({
          where: { id: data.truckId, tenantId }
        });

        if (!truck) {
          return rep.code(400).send({ message: "Caminhão não encontrado" });
        }
      }

      const trip = await prisma.trip.update({ 
        where: { id }, 
        data: {
          origin: data.origin ?? undefined,
          destination: data.destination,
          driver: data.driver,
          date: data.date,
          estimatedArrival: data.estimatedArrival ?? undefined,
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
      const tenantId = req.user!.tenantId;

      // Verificar se a viagem existe e pertence ao tenant
      const trip = await prisma.trip.findFirst({
        where: { id, tenantId },
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
      const tenantId = req.user!.tenantId;

      // Verify ownership before status update
      const existingTrip = await prisma.trip.findFirst({ where: { id, tenantId } });
      if (!existingTrip) {
        return rep.code(404).send({ message: "Viagem não encontrada" });
      }

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
      const tenantId = req.user!.tenantId;

      const where: any = { tenantId };

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

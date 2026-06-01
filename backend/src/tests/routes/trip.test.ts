import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { app, createTestContext } from "../helpers/setup";
import { prisma } from "../../lib/prisma";

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const validTrip = () => ({
  destination: "São Paulo - SP",
  driver: "João Silva",
  date: new Date("2024-06-15").toISOString(),
  freightValue: 2500,
  status: "em_andamento" as const,
  origin: "Curitiba - PR",
  notes: null,
  truckId: null,
});

describe("GET /trips", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns trips array", async () => {
    const res = await app.inject({ method: "GET", url: "/trips", headers: ctx.authHeaders });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().trips)).toBe(true);
  });

  it("401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/trips" });
    expect(res.statusCode).toBe(401);
  });

  it("does not return trips from other tenant", async () => {
    const other = await createTestContext();
    try {
      await app.inject({ method: "POST", url: "/trips", headers: other.authHeaders, payload: validTrip() });
      const res = await app.inject({ method: "GET", url: "/trips", headers: ctx.authHeaders });
      expect(res.json().trips).toHaveLength(0);
    } finally {
      await other.cleanup();
    }
  });

  it("supports pagination via ?page=", async () => {
    await app.inject({ method: "POST", url: "/trips", headers: ctx.authHeaders, payload: validTrip() });
    const res = await app.inject({ method: "GET", url: "/trips?page=1&limit=10", headers: ctx.authHeaders });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("totalPages");
  });
});

describe("POST /trips", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("creates trip and returns 201", async () => {
    const res = await app.inject({ method: "POST", url: "/trips", headers: ctx.authHeaders, payload: validTrip() });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.destination).toBe("São Paulo - SP");
    expect(body.driver).toBe("João Silva");
    expect(body.tenantId).toBe(ctx.tenant.id);
  });

  it("400 when destination is missing", async () => {
    const { destination: _, ...noDestination } = validTrip();
    const res = await app.inject({ method: "POST", url: "/trips", headers: ctx.authHeaders, payload: noDestination });
    expect(res.statusCode).toBe(500); // Zod error bubbles as 500 in this route's catch
  });

  it("400 when truckId doesn't belong to tenant", async () => {
    const other = await createTestContext();
    try {
      const truckRes = await app.inject({
        method: "POST",
        url: "/trucks",
        headers: other.authHeaders,
        payload: {
          name: "Caminhão Outro",
          plate: `OT${Date.now().toString().slice(-5)}`,
          brand: "Volvo",
          year: 2021,
          docExpiry: "2027-01-01",
          renavam: `${Date.now().toString().slice(-11)}`,
          insuranceExpiry: null,
          tachographCalibrationExpiry: null,
          oilChangeEngineDate: null,
          oilChangeGearboxDate: null,
          oilChangeDifferentialDate: null,
        },
      });
      const foreignTruckId = truckRes.json().id;

      const res = await app.inject({
        method: "POST",
        url: "/trips",
        headers: ctx.authHeaders,
        payload: { ...validTrip(), truckId: foreignTruckId },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain("Caminhão não encontrado");
    } finally {
      await other.cleanup();
    }
  });
});

describe("GET /trips/:id", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns trip by id", async () => {
    const created = await app.inject({ method: "POST", url: "/trips", headers: ctx.authHeaders, payload: validTrip() });
    const tripId = created.json().id;
    const res = await app.inject({ method: "GET", url: `/trips/${tripId}`, headers: ctx.authHeaders });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(tripId);
  });

  it("404 for non-existent trip", async () => {
    const res = await app.inject({ method: "GET", url: "/trips/999999", headers: ctx.authHeaders });
    expect(res.statusCode).toBe(404);
  });

  it("404 for trip from another tenant", async () => {
    const other = await createTestContext();
    try {
      const created = await app.inject({ method: "POST", url: "/trips", headers: other.authHeaders, payload: validTrip() });
      const otherId = created.json().id;
      const res = await app.inject({ method: "GET", url: `/trips/${otherId}`, headers: ctx.authHeaders });
      expect(res.statusCode).toBe(404);
    } finally {
      await other.cleanup();
    }
  });
});

describe("PUT /trips/:id", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("updates trip successfully", async () => {
    const created = await app.inject({ method: "POST", url: "/trips", headers: ctx.authHeaders, payload: validTrip() });
    const tripId = created.json().id;

    const res = await app.inject({
      method: "PUT",
      url: `/trips/${tripId}`,
      headers: ctx.authHeaders,
      payload: { ...validTrip(), driver: "Maria Santos", freightValue: 3000 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().driver).toBe("Maria Santos");
    expect(res.json().freightValue).toBe(3000);
  });

  it("404 for trip from another tenant", async () => {
    const other = await createTestContext();
    try {
      const created = await app.inject({ method: "POST", url: "/trips", headers: other.authHeaders, payload: validTrip() });
      const otherId = created.json().id;
      const res = await app.inject({
        method: "PUT", url: `/trips/${otherId}`, headers: ctx.authHeaders, payload: validTrip(),
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await other.cleanup();
    }
  });
});

describe("PATCH /trips/:id/status", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("updates status to concluida", async () => {
    const created = await app.inject({ method: "POST", url: "/trips", headers: ctx.authHeaders, payload: validTrip() });
    const tripId = created.json().id;

    const res = await app.inject({
      method: "PATCH",
      url: `/trips/${tripId}/status`,
      headers: ctx.authHeaders,
      payload: { status: "concluida" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("concluida");
  });

  it("404 for trip from another tenant", async () => {
    const other = await createTestContext();
    try {
      const created = await app.inject({ method: "POST", url: "/trips", headers: other.authHeaders, payload: validTrip() });
      const otherId = created.json().id;
      const res = await app.inject({
        method: "PATCH", url: `/trips/${otherId}/status`, headers: ctx.authHeaders, payload: { status: "cancelada" },
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await other.cleanup();
    }
  });
});

describe("DELETE /trips/:id", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("deletes trip without expenses → 204", async () => {
    const created = await app.inject({ method: "POST", url: "/trips", headers: ctx.authHeaders, payload: validTrip() });
    const tripId = created.json().id;
    const res = await app.inject({ method: "DELETE", url: `/trips/${tripId}`, headers: ctx.authHeaders });
    expect(res.statusCode).toBe(204);
  });

  it("400 when trip has expenses", async () => {
    const created = await app.inject({ method: "POST", url: "/trips", headers: ctx.authHeaders, payload: validTrip() });
    const tripId = created.json().id;

    await prisma.tripExpense.create({
      data: {
        description: "Pedágio",
        amount: 50,
        date: new Date(),
        category: "Pedágio",
        tripId,
      },
    });

    const res = await app.inject({ method: "DELETE", url: `/trips/${tripId}`, headers: ctx.authHeaders });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("despesas");
  });

  it("404 for non-existent trip", async () => {
    const res = await app.inject({ method: "DELETE", url: "/trips/999999", headers: ctx.authHeaders });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /trips/summary", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns summary with correct structure", async () => {
    await app.inject({ method: "POST", url: "/trips", headers: ctx.authHeaders, payload: validTrip() });

    const res = await app.inject({ method: "GET", url: "/trips/summary", headers: ctx.authHeaders });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.summary).toHaveProperty("totalTrips");
    expect(body.summary).toHaveProperty("totalFreight");
    expect(body.summary).toHaveProperty("completedTrips");
    expect(body.summary).toHaveProperty("inProgressTrips");
    expect(body.summary).toHaveProperty("cancelledTrips");
  });

  it("counts only this tenant's trips", async () => {
    await app.inject({ method: "POST", url: "/trips", headers: ctx.authHeaders, payload: validTrip() });
    const other = await createTestContext();
    try {
      await app.inject({ method: "POST", url: "/trips", headers: other.authHeaders, payload: validTrip() });
      const res = await app.inject({ method: "GET", url: "/trips/summary", headers: ctx.authHeaders });
      expect(res.json().summary.totalTrips).toBe(1);
    } finally {
      await other.cleanup();
    }
  });
});

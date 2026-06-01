import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { app, createTestContext } from "../helpers/setup";
import { prisma } from "../../lib/prisma";

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

async function createTrip(tenantId: number) {
  return prisma.trip.create({
    data: {
      destination: "Rio de Janeiro - RJ",
      driver: "Pedro Costa",
      date: new Date("2024-07-10"),
      freightValue: 1800,
      status: "em_andamento",
      tenantId,
    },
  });
}

const validExpense = (tripId: number) => ({
  description: "Combustível - Posto BR",
  amount: 350.5,
  date: "2024-07-10",
  category: "Combustível" as const,
  notes: "Abastecimento completo",
  tripId,
});

describe("POST /expenses", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let tripId: number;

  beforeEach(async () => {
    ctx = await createTestContext();
    const trip = await createTrip(ctx.tenant.id);
    tripId = trip.id;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("creates expense and returns 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: ctx.authHeaders,
      payload: validExpense(tripId),
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.description).toBe("Combustível - Posto BR");
    expect(Number(body.amount)).toBeCloseTo(350.5, 1);
    expect(body.category).toBe("Combustível");
    expect(body.Trip.id).toBe(tripId);
  });

  it("accepts DD/MM/YYYY date format", async () => {
    const payload = { ...validExpense(tripId), date: "10/07/2024" };
    const res = await app.inject({
      method: "POST", url: "/expenses", headers: ctx.authHeaders, payload,
    });
    expect(res.statusCode).toBe(201);
  });

  it("400 when tripId belongs to another tenant", async () => {
    const other = await createTestContext();
    try {
      const foreignTrip = await createTrip(other.tenant.id);
      const res = await app.inject({
        method: "POST",
        url: "/expenses",
        headers: ctx.authHeaders,
        payload: validExpense(foreignTrip.id),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain("Viagem não encontrada");
    } finally {
      await other.cleanup();
    }
  });

  it("400 when amount is zero", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: ctx.authHeaders,
      payload: { ...validExpense(tripId), amount: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("400 when category is invalid", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: ctx.authHeaders,
      payload: { ...validExpense(tripId), category: "Categoria Inválida" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("401 without token", async () => {
    const res = await app.inject({ method: "POST", url: "/expenses", payload: validExpense(tripId) });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /trips/:tripId/expenses", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let tripId: number;

  beforeEach(async () => {
    ctx = await createTestContext();
    const trip = await createTrip(ctx.tenant.id);
    tripId = trip.id;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns expenses for trip", async () => {
    await app.inject({
      method: "POST", url: "/expenses", headers: ctx.authHeaders, payload: validExpense(tripId),
    });
    const res = await app.inject({
      method: "GET", url: `/trips/${tripId}/expenses`, headers: ctx.authHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().expenses).toHaveLength(1);
  });

  it("404 for trip from another tenant", async () => {
    const other = await createTestContext();
    try {
      const foreignTrip = await createTrip(other.tenant.id);
      const res = await app.inject({
        method: "GET", url: `/trips/${foreignTrip.id}/expenses`, headers: ctx.authHeaders,
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await other.cleanup();
    }
  });

  it("404 for non-existent trip", async () => {
    const res = await app.inject({
      method: "GET", url: "/trips/999999/expenses", headers: ctx.authHeaders,
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /expenses/:id", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let tripId: number;

  beforeEach(async () => {
    ctx = await createTestContext();
    const trip = await createTrip(ctx.tenant.id);
    tripId = trip.id;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns expense by id", async () => {
    const created = await app.inject({
      method: "POST", url: "/expenses", headers: ctx.authHeaders, payload: validExpense(tripId),
    });
    const expenseId = created.json().id;
    const res = await app.inject({
      method: "GET", url: `/expenses/${expenseId}`, headers: ctx.authHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(expenseId);
  });

  it("404 for non-existent expense", async () => {
    const res = await app.inject({ method: "GET", url: "/expenses/999999", headers: ctx.authHeaders });
    expect(res.statusCode).toBe(404);
  });

  it("404 for expense from another tenant", async () => {
    const other = await createTestContext();
    try {
      const foreignTrip = await createTrip(other.tenant.id);
      const created = await app.inject({
        method: "POST", url: "/expenses", headers: other.authHeaders, payload: validExpense(foreignTrip.id),
      });
      const otherId = created.json().id;
      const res = await app.inject({
        method: "GET", url: `/expenses/${otherId}`, headers: ctx.authHeaders,
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await other.cleanup();
    }
  });
});

describe("PUT /expenses/:id", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let tripId: number;

  beforeEach(async () => {
    ctx = await createTestContext();
    const trip = await createTrip(ctx.tenant.id);
    tripId = trip.id;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("updates expense successfully", async () => {
    const created = await app.inject({
      method: "POST", url: "/expenses", headers: ctx.authHeaders, payload: validExpense(tripId),
    });
    const expenseId = created.json().id;

    const res = await app.inject({
      method: "PUT",
      url: `/expenses/${expenseId}`,
      headers: ctx.authHeaders,
      payload: { ...validExpense(tripId), description: "Pedágio BR-116", category: "Pedágio", amount: 25 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().description).toBe("Pedágio BR-116");
    expect(res.json().category).toBe("Pedágio");
  });

  it("404 for expense from another tenant", async () => {
    const other = await createTestContext();
    try {
      const foreignTrip = await createTrip(other.tenant.id);
      const created = await app.inject({
        method: "POST", url: "/expenses", headers: other.authHeaders, payload: validExpense(foreignTrip.id),
      });
      const otherId = created.json().id;
      const res = await app.inject({
        method: "PUT",
        url: `/expenses/${otherId}`,
        headers: ctx.authHeaders,
        payload: validExpense(tripId),
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await other.cleanup();
    }
  });
});

describe("DELETE /expenses/:id", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let tripId: number;

  beforeEach(async () => {
    ctx = await createTestContext();
    const trip = await createTrip(ctx.tenant.id);
    tripId = trip.id;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("deletes expense and returns 204", async () => {
    const created = await app.inject({
      method: "POST", url: "/expenses", headers: ctx.authHeaders, payload: validExpense(tripId),
    });
    const expenseId = created.json().id;
    const res = await app.inject({ method: "DELETE", url: `/expenses/${expenseId}`, headers: ctx.authHeaders });
    expect(res.statusCode).toBe(204);
  });

  it("404 when expense doesn't exist", async () => {
    const res = await app.inject({ method: "DELETE", url: "/expenses/999999", headers: ctx.authHeaders });
    expect(res.statusCode).toBe(404);
  });

  it("404 for expense from another tenant", async () => {
    const other = await createTestContext();
    try {
      const foreignTrip = await createTrip(other.tenant.id);
      const created = await app.inject({
        method: "POST", url: "/expenses", headers: other.authHeaders, payload: validExpense(foreignTrip.id),
      });
      const otherId = created.json().id;
      const res = await app.inject({ method: "DELETE", url: `/expenses/${otherId}`, headers: ctx.authHeaders });
      expect(res.statusCode).toBe(404);
    } finally {
      await other.cleanup();
    }
  });
});

describe("GET /expenses/summary", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let tripId: number;

  beforeEach(async () => {
    ctx = await createTestContext();
    const trip = await createTrip(ctx.tenant.id);
    tripId = trip.id;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns summary with totals", async () => {
    await app.inject({ method: "POST", url: "/expenses", headers: ctx.authHeaders, payload: validExpense(tripId) });
    await app.inject({
      method: "POST", url: "/expenses", headers: ctx.authHeaders,
      payload: { ...validExpense(tripId), description: "Pedágio", category: "Pedágio", amount: 40 },
    });

    const res = await app.inject({ method: "GET", url: "/expenses/summary", headers: ctx.authHeaders });
    expect(res.statusCode).toBe(200);
    const { summary } = res.json();
    expect(summary.totalExpenses).toBe(2);
    expect(summary.totalAmount).toBeCloseTo(390.5, 1);
    expect(summary).toHaveProperty("expensesByCategory");
    expect(summary.expensesByCategory["Combustível"]).toBeCloseTo(350.5, 1);
    expect(summary.expensesByCategory["Pedágio"]).toBeCloseTo(40, 1);
  });

  it("averageAmount is 0 when no expenses", async () => {
    const res = await app.inject({ method: "GET", url: "/expenses/summary", headers: ctx.authHeaders });
    const { summary } = res.json();
    expect(summary.averageAmount).toBe(0);
    expect(summary.totalExpenses).toBe(0);
  });

  it("only counts this tenant's expenses", async () => {
    const other = await createTestContext();
    try {
      const foreignTrip = await createTrip(other.tenant.id);
      await app.inject({
        method: "POST", url: "/expenses", headers: other.authHeaders, payload: validExpense(foreignTrip.id),
      });
      const res = await app.inject({ method: "GET", url: "/expenses/summary", headers: ctx.authHeaders });
      expect(res.json().summary.totalExpenses).toBe(0);
    } finally {
      await other.cleanup();
    }
  });
});

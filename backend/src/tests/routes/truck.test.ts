import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { app, createTestContext } from "../helpers/setup";

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const validTruck = () => ({
  name: "Scania R450",
  plate: `TST${Date.now().toString().slice(-4)}`,
  brand: "Scania",
  year: 2022,
  docExpiry: "2027-06-30",
  renavam: `${Date.now().toString().slice(-11)}`,
  insuranceExpiry: null,
  tachographCalibrationExpiry: null,
  oilChangeEngineDate: null,
  oilChangeGearboxDate: null,
  oilChangeDifferentialDate: null,
});

describe("GET /trucks", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns trucks array for authenticated tenant", async () => {
    const res = await app.inject({ method: "GET", url: "/trucks", headers: ctx.authHeaders });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("trucks");
    expect(Array.isArray(res.json().trucks)).toBe(true);
  });

  it("401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/trucks" });
    expect(res.statusCode).toBe(401);
  });

  it("does not return trucks from other tenant", async () => {
    const other = await createTestContext();
    try {
      const payload = validTruck();
      await app.inject({ method: "POST", url: "/trucks", headers: other.authHeaders, payload });
      const res = await app.inject({ method: "GET", url: "/trucks", headers: ctx.authHeaders });
      const trucks = res.json().trucks as any[];
      const leaked = trucks.find((t) => t.plate === payload.plate);
      expect(leaked).toBeUndefined();
    } finally {
      await other.cleanup();
    }
  });
});

describe("POST /trucks", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("creates truck and returns 201", async () => {
    const payload = validTruck();
    const res = await app.inject({ method: "POST", url: "/trucks", headers: ctx.authHeaders, payload });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.plate).toBe(payload.plate);
    expect(body.tenantId).toBe(ctx.tenant.id);
  });

  it("400 on duplicate plate within same tenant", async () => {
    const payload = validTruck();
    await app.inject({ method: "POST", url: "/trucks", headers: ctx.authHeaders, payload });
    const res = await app.inject({ method: "POST", url: "/trucks", headers: ctx.authHeaders, payload });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("placa");
  });

  it("400 when required field is missing (no plate)", async () => {
    const { plate: _plate, ...noPlate } = validTruck();
    const res = await app.inject({ method: "POST", url: "/trucks", headers: ctx.authHeaders, payload: noPlate });
    expect(res.statusCode).toBe(400);
  });

  it("400 when year is invalid", async () => {
    const payload = { ...validTruck(), year: 1800 };
    const res = await app.inject({ method: "POST", url: "/trucks", headers: ctx.authHeaders, payload });
    expect(res.statusCode).toBe(400);
  });
});

describe("PUT /trucks/:id", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("updates truck successfully", async () => {
    const created = await app.inject({
      method: "POST", url: "/trucks", headers: ctx.authHeaders, payload: validTruck(),
    });
    const truckId = created.json().id;

    const updated = { ...validTruck(), name: "Atualizado SA" };
    const res = await app.inject({
      method: "PUT", url: `/trucks/${truckId}`, headers: ctx.authHeaders, payload: updated,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Atualizado SA");
  });

  it("404 when truck does not belong to tenant", async () => {
    const other = await createTestContext();
    try {
      const created = await app.inject({
        method: "POST", url: "/trucks", headers: other.authHeaders, payload: validTruck(),
      });
      const otherId = created.json().id;

      const res = await app.inject({
        method: "PUT", url: `/trucks/${otherId}`, headers: ctx.authHeaders, payload: validTruck(),
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await other.cleanup();
    }
  });

  it("404 for non-existent truck id", async () => {
    const res = await app.inject({
      method: "PUT", url: "/trucks/999999", headers: ctx.authHeaders, payload: validTruck(),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /trucks/:id", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("deletes truck and returns 204", async () => {
    const created = await app.inject({
      method: "POST", url: "/trucks", headers: ctx.authHeaders, payload: validTruck(),
    });
    const truckId = created.json().id;
    const res = await app.inject({ method: "DELETE", url: `/trucks/${truckId}`, headers: ctx.authHeaders });
    expect(res.statusCode).toBe(204);
  });

  it("404 when truck not found", async () => {
    const res = await app.inject({ method: "DELETE", url: "/trucks/999999", headers: ctx.authHeaders });
    expect(res.statusCode).toBe(404);
  });

  it("404 when trying to delete another tenant's truck", async () => {
    const other = await createTestContext();
    try {
      const created = await app.inject({
        method: "POST", url: "/trucks", headers: other.authHeaders, payload: validTruck(),
      });
      const otherId = created.json().id;
      const res = await app.inject({ method: "DELETE", url: `/trucks/${otherId}`, headers: ctx.authHeaders });
      expect(res.statusCode).toBe(404);
    } finally {
      await other.cleanup();
    }
  });
});

describe("GET /trucks/:id", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns truck by id", async () => {
    const created = await app.inject({
      method: "POST", url: "/trucks", headers: ctx.authHeaders, payload: validTruck(),
    });
    const truckId = created.json().id;
    const res = await app.inject({ method: "GET", url: `/trucks/${truckId}`, headers: ctx.authHeaders });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(truckId);
  });

  it("404 for non-existent id", async () => {
    const res = await app.inject({ method: "GET", url: "/trucks/999999", headers: ctx.authHeaders });
    expect(res.statusCode).toBe(404);
  });
});

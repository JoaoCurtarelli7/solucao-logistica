import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { app, createTestContext } from "../helpers/setup";
import { prisma } from "../../lib/prisma";

const SECRET = process.env.JWT_SECRET!;

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("authMiddleware — token validation", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("401 when Authorization header is absent", async () => {
    const res = await app.inject({ method: "GET", url: "/trucks" });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toContain("ausente");
  });

  it("401 when format is not Bearer <token>", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/trucks",
      headers: { Authorization: "Basic abc123" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("401 when token is invalid JWT", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/trucks",
      headers: { Authorization: "Bearer not.a.valid.jwt" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toContain("inválido");
  });

  it("401 when token is expired", async () => {
    const expiredToken = jwt.sign(
      { userId: ctx.user.id, exp: Math.floor(Date.now() / 1000) - 60 },
      SECRET,
    );
    const res = await app.inject({
      method: "GET",
      url: "/trucks",
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toContain("expirado");
  });

  it("200 with valid token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/trucks",
      headers: ctx.authHeaders,
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("authMiddleware — plan checks", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("403 when tenant is suspended", async () => {
    await prisma.tenant.update({
      where: { id: ctx.tenant.id },
      data: { status: "suspended" },
    });
    const res = await app.inject({
      method: "GET",
      url: "/trucks",
      headers: ctx.authHeaders,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ACCOUNT_SUSPENDED");
  });

  it("402 when plan is expired", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24); // yesterday
    await prisma.tenant.update({
      where: { id: ctx.tenant.id },
      data: { planExpiresAt: past },
    });
    const res = await app.inject({
      method: "GET",
      url: "/trucks",
      headers: ctx.authHeaders,
    });
    expect(res.statusCode).toBe(402);
    expect(res.json().code).toBe("PLAN_EXPIRED");
  });
});

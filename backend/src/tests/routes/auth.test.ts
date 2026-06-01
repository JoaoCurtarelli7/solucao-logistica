import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { app, createTestContext, TEST_PASSWORD } from "../helpers/setup";
import { prisma } from "../../lib/prisma";

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("POST /login", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns token and user data on valid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: ctx.user.email, password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(body.user.id).toBe(ctx.user.id);
    expect(body.user.email).toBe(ctx.user.email);
    expect(body.user).not.toHaveProperty("password");
  });

  it("includes permissions array in response", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: ctx.user.email, password: TEST_PASSWORD },
    });
    const body = res.json();
    expect(Array.isArray(body.user.permissions)).toBe(true);
  });

  it("401 on wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: ctx.user.email, password: "WrongPass999!" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toContain("inválidos");
  });

  it("401 on unknown email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: "nobody@nowhere.local", password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(401);
  });

  it("400 on invalid email format", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: "not-an-email", password: "pass123" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("400 when body fields are missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("403 on inactive user", async () => {
    await prisma.user.update({
      where: { id: ctx.user.id },
      data: { status: "inactive" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: ctx.user.email, password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(403);
  });

  it("403 when tenant is not active", async () => {
    await prisma.tenant.update({
      where: { id: ctx.tenant.id },
      data: { status: "suspended" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: ctx.user.email, password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /auth/bootstrap-status", () => {
  it("returns firstUserSetup boolean", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/bootstrap-status" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("firstUserSetup");
    expect(typeof body.firstUserSetup).toBe("boolean");
  });

  it("firstUserSetup is false when users exist", async () => {
    const ctx = await createTestContext();
    try {
      const res = await app.inject({ method: "GET", url: "/auth/bootstrap-status" });
      expect(res.json().firstUserSetup).toBe(false);
    } finally {
      await ctx.cleanup();
    }
  });
});

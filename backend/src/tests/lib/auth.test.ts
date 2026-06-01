import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { hashPassword, comparePasswords, generateToken, verifyToken } from "../../lib/auth";

const SECRET = process.env.JWT_SECRET!;

describe("hashPassword", () => {
  it("returns bcrypt hash starting with $2b$", async () => {
    const hash = await hashPassword("mypassword");
    expect(hash).toMatch(/^\$2b\$/);
  });

  it("two calls with same input produce different hashes (salt)", async () => {
    const h1 = await hashPassword("same");
    const h2 = await hashPassword("same");
    expect(h1).not.toBe(h2);
  });
});

describe("comparePasswords", () => {
  it("returns true for matching password", async () => {
    const hash = await hashPassword("correct");
    expect(await comparePasswords("correct", hash)).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("correct");
    expect(await comparePasswords("wrong", hash)).toBe(false);
  });

  it("returns false for empty string against real hash", async () => {
    const hash = await hashPassword("something");
    expect(await comparePasswords("", hash)).toBe(false);
  });
});

describe("generateToken", () => {
  it("generates a 3-part JWT string", () => {
    const token = generateToken({ userId: 1 });
    expect(token.split(".")).toHaveLength(3);
  });

  it("embeds payload in token", () => {
    const token = generateToken({ userId: 42, tenantId: 7, isSuperAdmin: false });
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.userId).toBe(42);
    expect(decoded.tenantId).toBe(7);
    expect(decoded.isSuperAdmin).toBe(false);
  });

  it("includes exp claim (expires in ~1h)", () => {
    const before = Math.floor(Date.now() / 1000);
    const token = generateToken({ userId: 1 });
    const decoded = jwt.decode(token) as Record<string, unknown>;
    const exp = decoded.exp as number;
    expect(exp).toBeGreaterThan(before + 3500);
    expect(exp).toBeLessThanOrEqual(before + 3610);
  });
});

describe("verifyToken", () => {
  it("verifies a valid token and returns payload", () => {
    const token = generateToken({ userId: 5, role: "Admin" });
    const decoded = verifyToken(token) as Record<string, unknown>;
    expect(decoded.userId).toBe(5);
    expect(decoded.role).toBe("Admin");
  });

  it("throws JsonWebTokenError on tampered token", () => {
    const token = generateToken({ userId: 1 });
    const tampered = token.slice(0, -5) + "XXXXX";
    expect(() => verifyToken(tampered)).toThrow();
  });

  it("throws JsonWebTokenError on completely invalid string", () => {
    expect(() => verifyToken("not.a.token")).toThrow();
  });

  it("throws TokenExpiredError on expired token", () => {
    const expired = jwt.sign(
      { userId: 1, exp: Math.floor(Date.now() / 1000) - 100 },
      SECRET,
    );
    let error: any;
    try {
      verifyToken(expired);
    } catch (e) {
      error = e;
    }
    expect(error?.name).toBe("TokenExpiredError");
  });

  it("throws on token signed with wrong secret", () => {
    const wrongToken = jwt.sign({ userId: 1 }, "wrong-secret-entirely");
    expect(() => verifyToken(wrongToken)).toThrow();
  });
});

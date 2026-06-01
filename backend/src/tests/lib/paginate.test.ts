import { describe, it, expect } from "vitest";
import { paginationMeta, paginationSchema } from "../../lib/paginate";

describe("paginationMeta", () => {
  it("calculates totalPages correctly", () => {
    expect(paginationMeta(100, 1, 10).totalPages).toBe(10);
  });

  it("rounds up partial page", () => {
    expect(paginationMeta(101, 1, 10).totalPages).toBe(11);
  });

  it("zero total → 0 pages", () => {
    expect(paginationMeta(0, 1, 10).totalPages).toBe(0);
  });

  it("returns all fields", () => {
    const meta = paginationMeta(75, 3, 25);
    expect(meta).toEqual({ total: 75, page: 3, limit: 25, totalPages: 3 });
  });

  it("single item fits in 1 page regardless of limit", () => {
    expect(paginationMeta(1, 1, 50).totalPages).toBe(1);
  });
});

describe("paginationSchema", () => {
  it("defaults page=1 and limit=50", () => {
    expect(paginationSchema.parse({})).toMatchObject({ page: 1, limit: 50 });
  });

  it("coerces string numbers", () => {
    expect(paginationSchema.parse({ page: "3", limit: "20" })).toMatchObject({ page: 3, limit: 20 });
  });

  it("passes optional search through", () => {
    const result = paginationSchema.parse({ search: "João" });
    expect(result.search).toBe("João");
  });

  it("rejects page < 1", () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
  });

  it("rejects limit > 200", () => {
    expect(() => paginationSchema.parse({ limit: 201 })).toThrow();
  });

  it("rejects limit < 1", () => {
    expect(() => paginationSchema.parse({ limit: 0 })).toThrow();
  });

  it("accepts limit exactly 200", () => {
    expect(() => paginationSchema.parse({ limit: 200 })).not.toThrow();
  });
});

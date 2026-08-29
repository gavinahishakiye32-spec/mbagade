import { describe, it, expect } from "vitest";
import { businessAccessFor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { slugifyUsername, escapeRegExp, formatCount } from "@/lib/utils";

const user = (role: "customer" | "business" | "admin", id = "u1") =>
  ({ _id: id, role }) as never;

describe("businessAccessFor", () => {
  it("grants admins full access to any business", () => {
    const access = businessAccessFor(user("admin"), null, "other-owner");
    expect(access.canManage).toBe(true);
    expect(access.isOwner).toBe(true);
  });

  it("treats the ownerUserId match as owner", () => {
    const access = businessAccessFor(user("business", "owner-1"), null, "owner-1");
    expect(access.isOwner).toBe(true);
    expect(access.canManage).toBe(true);
  });

  it("maps member roles correctly", () => {
    expect(businessAccessFor(user("business"), "manager", "someone").canManage).toBe(true);
    expect(businessAccessFor(user("business"), "editor", "someone").canManage).toBe(true);
    expect(businessAccessFor(user("business"), "editor", "someone").canModerate).toBe(false);
    expect(businessAccessFor(user("business"), null, "someone").canManage).toBe(false);
  });

  it("denies anonymous users", () => {
    const access = businessAccessFor(null, "manager", "x");
    expect(access.canManage).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows requests under the limit and blocks beyond it", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    const a = rateLimit(`a:${Math.random()}`, 1, 60_000);
    const b = rateLimit(`b:${Math.random()}`, 1, 60_000);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  it("reports remaining count", () => {
    const key = `rem:${Math.random()}`;
    expect(rateLimit(key, 2, 60_000).remaining).toBe(1);
    expect(rateLimit(key, 2, 60_000).remaining).toBe(0);
  });
});

describe("utils", () => {
  it("slugifyUsername produces safe handles", () => {
    expect(slugifyUsername("Amara's Shea Butter!")).toMatch(/^[a-z0-9]+$/);
    expect(slugifyUsername("   ")).toHaveLength(0);
  });

  it("escapeRegExp escapes special characters", () => {
    expect(escapeRegExp("a.b*c")).toBe("a\\.b\\*c");
  });

  it("formatCount abbreviates large numbers", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1500)).toBe("1.5K");
    expect(formatCount(2_300_000)).toBe("2.3M");
  });
});

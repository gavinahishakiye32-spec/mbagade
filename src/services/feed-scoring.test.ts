import { describe, it, expect } from "vitest";
import { computePostScore, shouldRescore, extractHashtags } from "@/services/feed-scoring";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

const base = {
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  followsGenerated: 0,
  productClicks: 0,
  contactClicks: 0,
  views: 0,
  reports: 0,
  createdAtMs: NOW - HOUR,
  nowMs: NOW,
  newBusiness: false,
};

describe("computePostScore", () => {
  it("returns a positive score for a fresh post with no engagement", () => {
    expect(computePostScore(base)).toBeGreaterThan(0);
  });

  it("rewards engagement", () => {
    const engaged = computePostScore({ ...base, likes: 50, comments: 10, shares: 5, saves: 8 });
    expect(engaged).toBeGreaterThan(computePostScore(base));
  });

  it("decays over time (recency half-life)", () => {
    const fresh = computePostScore({ ...base, likes: 100 });
    const old = computePostScore({ ...base, likes: 100, createdAtMs: NOW - 72 * HOUR });
    expect(old).toBeLessThan(fresh);
    expect(old).toBeGreaterThan(0); // never fully disappears
  });

  it("boosts new businesses for discovery", () => {
    const newBiz = computePostScore({ ...base, likes: 100, newBusiness: true });
    const oldBiz = computePostScore({ ...base, likes: 100 });
    expect(newBiz).toBeGreaterThan(oldBiz);
  });

  it("penalizes reported content", () => {
    const clean = computePostScore({ ...base, likes: 100 });
    const flagged = computePostScore({ ...base, likes: 100, reports: 3 });
    expect(flagged).toBeLessThan(clean);
  });

  it("applies category affinity and local boost", () => {
    const plain = computePostScore({ ...base, likes: 10 });
    const affinity = computePostScore({ ...base, likes: 10, categoryAffinity: 1 });
    const local = computePostScore({ ...base, likes: 10, sameCity: true });
    expect(affinity).toBeGreaterThan(plain);
    expect(local).toBeGreaterThan(plain);
  });

  it("is deterministic", () => {
    expect(computePostScore(base)).toBe(computePostScore(base));
  });

  it("short-video mode amplifies spread/re-watch signals (shares, saves)", () => {
    const shareHeavy = {
      likes: 10,
      comments: 2,
      shares: 40,
      saves: 15,
      followsGenerated: 1,
      productClicks: 0,
      contactClicks: 0,
      views: 500,
      reports: 0,
    };
    const viral = computePostScore({ ...base, ...shareHeavy, shortVideo: true });
    const neutral = computePostScore({ ...base, ...shareHeavy });
    expect(viral).toBeGreaterThan(neutral);
  });

  it("short-video mode down-weights business-only actions (contact clicks)", () => {
    const bizHeavy = {
      likes: 50,
      comments: 4,
      shares: 10,
      saves: 5,
      followsGenerated: 2,
      productClicks: 20,
      contactClicks: 30,
      views: 1000,
      reports: 0,
    };
    const viral = computePostScore({ ...base, ...bizHeavy, shortVideo: true });
    const neutral = computePostScore({ ...base, ...bizHeavy });
    expect(viral).toBeLessThan(neutral);
  });
});

describe("shouldRescore", () => {
  it("rescores after the TTL window", () => {
    expect(shouldRescore(new Date(NOW - 11 * 60_000), NOW)).toBe(true);
  });

  it("skips rescoring inside the window", () => {
    expect(shouldRescore(new Date(NOW - 2 * 60_000), NOW)).toBe(false);
  });

  it("rescores when never scored", () => {
    expect(shouldRescore(null, NOW)).toBe(true);
  });
});

describe("extractHashtags", () => {
  it("extracts lowercase unique hashtags", () => {
    expect(extractHashtags("Hello #World this is #Test and #world again")).toEqual(["world", "test"]);
  });

  it("returns empty array when no hashtags", () => {
    expect(extractHashtags("no tags here")).toEqual([]);
  });

  it("caps at 20 tags and strips the # symbol", () => {
    const many = Array.from({ length: 30 }, (_, i) => `#tag${i}`).join(" ");
    const tags = extractHashtags(many);
    expect(tags).toHaveLength(20);
    expect(tags[0]).toBe("tag0");
  });
});

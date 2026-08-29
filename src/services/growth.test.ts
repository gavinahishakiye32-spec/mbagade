import { describe, expect, it } from "vitest";
import { offerAvailability } from "@/services/offer.service";
import { generateReferralCode } from "@/services/growth.service";

const DAY = 86400000;

describe("offerAvailability", () => {
  const startMs = Date.parse("2026-01-10T00:00:00Z");
  const endMs = Date.parse("2026-01-20T00:00:00Z");

  it("returns draft for draft status regardless of dates", () => {
    expect(offerAvailability("draft", new Date(startMs), new Date(endMs), Date.parse("2026-01-15"))).toBe("draft");
    expect(offerAvailability("draft", new Date(Date.now() - DAY), new Date(Date.now() + DAY))).toBe("draft");
  });

  it("returns scheduled when now is before the window", () => {
    expect(offerAvailability("active", new Date(startMs), new Date(endMs), Date.parse("2026-01-05"))).toBe("scheduled");
  });

  it("returns active inside the window", () => {
    expect(offerAvailability("active", new Date(startMs), new Date(endMs), Date.parse("2026-01-15"))).toBe("active");
  });

  it("treats boundary instants as active (inclusive)", () => {
    expect(offerAvailability("active", new Date(startMs), new Date(endMs), startMs)).toBe("active");
    expect(offerAvailability("active", new Date(startMs), new Date(endMs), endMs)).toBe("active");
  });

  it("returns expired after the window even when status is active", () => {
    expect(offerAvailability("active", new Date(startMs), new Date(endMs), Date.parse("2026-02-01"))).toBe("expired");
  });

  it("returns paused when paused inside the window", () => {
    expect(offerAvailability("paused", new Date(startMs), new Date(endMs), Date.parse("2026-01-15"))).toBe("paused");
  });
});

describe("generateReferralCode", () => {
  it("generates 8-character codes", () => {
    expect(generateReferralCode()).toHaveLength(8);
  });

  it("only uses unambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateReferralCode()).toMatch(/^[A-HJ-KM-NP-Z2-9]+$/);
    }
  });

  it("produces unique codes across many draws", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateReferralCode()));
    expect(codes.size).toBe(500);
  });
});

import { PlatformSetting } from "@/server/models";
import { env } from "@/lib/env";
import type { AccessMode } from "@/config/constants";

/**
 * Admin-configurable platform settings (development addendum #13, #20, #7, #8).
 * Stored as a single PlatformSetting document so launch locations, the access
 * lifecycle and founding-program benefits can change at runtime without a deploy.
 * Nothing here is hard-coded to one city or country — empty lists mean worldwide.
 */

export interface PlatformConfig {
  accessMode: AccessMode;
  /** Empty array = no geographic restriction (global). */
  launchCountries: string[];
  launchCities: string[];
  launchRegions: string[];
  foundingProgram: {
    enabled: boolean;
    businessBadgeText: string;
    customerBadgeText: string;
    /** Accounts created before these dates automatically receive founding status. null = manual only. */
    autoGrantBusinessUntil: string | null;
    autoGrantCustomerUntil: string | null;
  };
  referralEnabled: boolean;
}

const CONFIG_KEY = "platform";

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  accessMode: (env.accessMode as AccessMode) ?? "public",
  launchCountries: [],
  launchCities: [],
  launchRegions: [],
  foundingProgram: {
    enabled: true,
    businessBadgeText: "Founding Business",
    customerBadgeText: "Founding Customer",
    autoGrantBusinessUntil: null,
    autoGrantCustomerUntil: null,
  },
  referralEnabled: true,
};

export async function getPlatformConfig(): Promise<PlatformConfig> {
  const doc = await PlatformSetting.findOne({ key: CONFIG_KEY }).lean<{ key: string; value: Partial<PlatformConfig> } | null>();
  if (!doc?.value) return { ...DEFAULT_PLATFORM_CONFIG };
  return {
    ...DEFAULT_PLATFORM_CONFIG,
    ...doc.value,
    foundingProgram: { ...DEFAULT_PLATFORM_CONFIG.foundingProgram, ...(doc.value.foundingProgram ?? {}) },
  };
}

export type PlatformConfigPatch = {
  [K in keyof PlatformConfig]?: PlatformConfig[K] extends readonly unknown[]
    ? PlatformConfig[K]
    : PlatformConfig[K] extends object
      ? Partial<PlatformConfig[K]>
      : PlatformConfig[K];
};

export async function updatePlatformConfig(patch: PlatformConfigPatch): Promise<PlatformConfig> {
  const current = await getPlatformConfig();
  const next: PlatformConfig = {
    ...current,
    ...patch,
    launchCountries: patch.launchCountries ?? current.launchCountries,
    launchCities: patch.launchCities ?? current.launchCities,
    launchRegions: patch.launchRegions ?? current.launchRegions,
    foundingProgram: { ...current.foundingProgram, ...(patch.foundingProgram ?? {}) },
  };
  await PlatformSetting.updateOne(
    { key: CONFIG_KEY },
    { $set: { value: next } },
    { upsert: true }
  );
  return next;
}

/** Public subset served to anonymous clients (register page, discover, waitlist). */
export function publicPlatformConfig(config: PlatformConfig) {
  return {
    accessMode: config.accessMode,
    launchCountries: config.launchCountries,
    launchCities: config.launchCities,
    launchRegions: config.launchRegions,
    foundingProgram: {
      enabled: config.foundingProgram.enabled,
      businessBadgeText: config.foundingProgram.businessBadgeText,
      customerBadgeText: config.foundingProgram.customerBadgeText,
    },
    referralEnabled: config.referralEnabled,
  };
}

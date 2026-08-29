import { handle, ok } from "@/lib/api";
import { getPlatformConfig, publicPlatformConfig } from "@/services/platform-config.service";
import { connectDB } from "@/lib/mongodb";

/** Public platform configuration: access mode, launch locations, founding badges. */
export const GET = handle(async () => {
  await connectDB();
  const config = await getPlatformConfig();
  return ok(publicPlatformConfig(config));
});

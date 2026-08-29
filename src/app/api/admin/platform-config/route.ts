import { handle, ok, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { adminPlatformConfigSchema } from "@/lib/validation";
import { getPlatformConfig, updatePlatformConfig } from "@/services/platform-config.service";
import { auditLog } from "@/services/admin.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await connectDB();
  await requireAdmin();
  return ok(await getPlatformConfig());
});

export const PATCH = handle(async (req: Request) => {
  await connectDB();
  const admin = await requireAdmin();
  const patch = await parseJson(req, adminPlatformConfigSchema);
  const config = await updatePlatformConfig(patch);
  await auditLog(String(admin._id), "platform_config_update", "platform", null, patch);
  return ok(config);
});

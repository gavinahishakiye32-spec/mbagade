import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { adminClaimResolveSchema } from "@/lib/validation";
import { listClaims, resolveClaim } from "@/services/growth.service";
import { auditLog } from "@/services/admin.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await connectDB();
  await requireAdmin();
  const url = new URL(req.url);
  const items = await listClaims(url.searchParams.get("status") ?? undefined);
  return ok({ items });
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const admin = await requireAdmin();
  const url = new URL(req.url);
  const claimId = url.searchParams.get("id");
  if (!claimId || !/^[a-f0-9]{24}$/i.test(claimId)) throw new ApiError("VALIDATION_ERROR", "Claim id required", 422);
  const input = await parseJson(req, adminClaimResolveSchema);
  await resolveClaim(String(admin._id), claimId, input.decision, input.reviewNote);
  await auditLog(String(admin._id), `claim_${input.decision}`, "claim_request", null, { claimId });
  return ok({ resolved: true });
});

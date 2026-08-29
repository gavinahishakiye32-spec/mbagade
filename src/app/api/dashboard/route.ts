import { handle, ok, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { businessSummary } from "@/services/analytics.service";
import { BusinessMember } from "@/server/models";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/** GET /api/dashboard?businessId=&days=30 — business analytics (members only). */
export const GET = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");
  if (!businessId || !/^[a-f0-9]{24}$/i.test(businessId)) throw new ApiError("INVALID_INPUT", "businessId required", 422);

  const member = await BusinessMember.exists({ businessId, userId: user._id });
  if (!member && user.role !== "admin") throw new ApiError("FORBIDDEN", "Not your business", 403);

  const days = Math.min(Number(url.searchParams.get("days") ?? 30), 90);
  return ok(await businessSummary(businessId, days));
});

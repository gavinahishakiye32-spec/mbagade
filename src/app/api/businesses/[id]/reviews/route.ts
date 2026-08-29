import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { reviewCreateSchema } from "@/lib/validation";
import { listReviews, addReview } from "@/services/business.service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const result = await listReviews(id, cursor, 10);
  return ok(result);
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  enforceRateLimit(req, "review", 5, 60 * 60 * 1000, String(user._id));
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new ApiError("NOT_FOUND", "Business not found", 404);
  const input = await parseJson(req, reviewCreateSchema);
  await addReview(String(user._id), id, input.rating, input.text);
  return ok({ created: true });
});

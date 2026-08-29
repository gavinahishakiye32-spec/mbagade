import { handle, ok } from "@/lib/api";
import { getAuthUser, requireUser } from "@/lib/auth";
import { toggleFollow } from "@/services/business.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const result = await toggleFollow(String(user._id), id);
  return ok(result);
});

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const viewer = await getAuthUser();
  const { id } = await ctx.params;
  return ok({ following: viewer ? await isFollowingSafe(String(viewer._id), id) : false });
});

async function isFollowingSafe(userId: string, businessId: string): Promise<boolean> {
  const { isFollowing } = await import("@/services/business.service");
  return isFollowing(userId, businessId);
}

import { handle, ok, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getPublicUser, toggleFollowUser } from "@/services/user.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ username: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { username } = await ctx.params;
  const target = await getPublicUser(username);
  if (!target || target.status === "banned") throw new ApiError("NOT_FOUND", "User not found", 404);
  const { isFollowingUser } = await import("@/services/user.service");
  return ok({ following: await isFollowingUser(String(user._id), String(target._id)) });
});

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ username: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { username } = await ctx.params;
  const target = await getPublicUser(username);
  if (!target || target.status === "banned") throw new ApiError("NOT_FOUND", "User not found", 404);
  const result = await toggleFollowUser(String(user._id), String(target._id));
  return ok(result);
});

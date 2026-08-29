import { handle, ok, ApiError } from "@/lib/api";
import { getLive } from "@/services/live.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await ctx.params;
  const result = await getLive(id);
  if (!result) throw new ApiError("NOT_FOUND", "Live stream not found", 404);
  return ok({
    live: {
      id: String(result.live._id),
      title: result.live.title,
      embedUrl: result.live.embedUrl,
      status: result.live.status,
      viewers: result.live.viewers,
      startedAt: result.live.startedAt.toISOString(),
    },
    business: {
      name: result.business.name,
      username: result.business.username,
      logoUrl: result.business.logoKey ? `/api/media/${result.business.logoKey}` : null,
      verified: result.business.verified,
    },
  });
});

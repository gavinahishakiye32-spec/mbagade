import { handle, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { feedQuerySchema } from "@/lib/validation";
import { getFeed, pickSponsored } from "@/services/feed.service";
import { loadViewerContext, toPostView } from "@/services/view.service";
import { recordImpression } from "@/services/ad.service";
import { track } from "@/services/analytics.service";
import { connectDB } from "@/lib/mongodb";
import type { PostView } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/feed — the discovery engine.
 * Tabs: for-you (ranked), following, trending, nearby (+ category filter).
 * First page may include sponsored posts (clearly labelled).
 */
export const GET = handle(async (req: Request) => {
  await connectDB();
  const url = new URL(req.url);
  const params = feedQuerySchema.parse(Object.fromEntries(url.searchParams));
  const viewer = await getAuthUser();
  const viewerId = viewer ? String(viewer._id) : null;

  const result = await getFeed(params, viewerId);

  // Sponsored injection on the first page only
  if (!params.cursor) {
    const sponsored = await pickSponsored(params.country ?? viewer?.country ?? null, 1);
    for (const s of sponsored) {
      if (result.items.some((i) => i.id === String(s.post._id))) continue;
      const business = await (await import("@/server/models")).Business.findById(s.post.businessId).lean();
      if (!business) continue;
      const ctx = await loadViewerContext(viewerId, [s.post]);
      const view: PostView = toPostView(s.post, business, ctx, {
        sponsoredLabel: s.label,
      });
      result.items.splice(Math.min(2, result.items.length), 0, view);
      void recordImpression(s.adId);
      void track({ type: "ad_impression", userId: viewerId, businessId: business._id, postId: s.post._id, advertisementId: s.adId });
    }
  }

  return ok(result);
});

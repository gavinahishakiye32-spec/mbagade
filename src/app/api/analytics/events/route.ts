import { handle, ok, parseJson } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { analyticsEventSchema } from "@/lib/validation";
import { track } from "@/services/analytics.service";
import { Post, Product, Business } from "@/server/models";
import { enforceRateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * POST /api/analytics/events — client-side event tracking.
 * Resolves the owning business from the referenced entity and updates
 * denormalized counters. Public (visitors are tracked too).
 */
export const POST = handle(async (req: Request) => {
  await connectDB();
  enforceRateLimit(req, "analytics", 120, 60 * 1000);
  const viewer = await getAuthUser();
  const input = await parseJson(req, analyticsEventSchema);

  let businessId = null as string | null;
  let postId = null as string | null;
  let productId = null as string | null;

  if (input.postId) {
    const post = await Post.findById(input.postId).select("businessId").lean();
    if (!post) return ok({ tracked: false });
    postId = String(post._id);
    businessId = String(post.businessId);
    if (input.type === "post_view") {
      await Post.updateOne({ _id: post._id }, { $inc: { viewsCount: 1 } });
    }
  }
  if (input.productId) {
    const product = await Product.findById(input.productId).select("businessId").lean();
    if (!product) return ok({ tracked: false });
    productId = String(product._id);
    businessId = String(product.businessId);
    if (input.type === "product_click") {
      await Product.updateOne({ _id: product._id }, { $inc: { viewsCount: 1 } });
      if (postId) await Post.updateOne({ _id: postId }, { $inc: { productClicks: 1 } });
    }
  }

  if (!businessId) return ok({ tracked: false });

  // contact/website/whatsapp clicks also bump business counters
  if (input.type === "contact_click") {
    await Business.updateOne({ _id: businessId }, { $inc: { contactClicks: 1 } });
    if (postId) await Post.updateOne({ _id: postId }, { $inc: { contactClicks: 1 } });
  } else if (input.type === "website_click") {
    await Business.updateOne({ _id: businessId }, { $inc: { websiteClicks: 1 } });
  } else if (input.type === "whatsapp_click") {
    await Business.updateOne({ _id: businessId }, { $inc: { whatsappClicks: 1 } });
  } else if (input.type === "profile_visit") {
    await Business.updateOne({ _id: businessId }, { $inc: { viewsCount: 1 } });
  }

  track({
    type: input.type,
    userId: viewer ? String(viewer._id) : null,
    businessId,
    postId,
    productId,
    valueMs: input.valueMs,
    country: viewer?.country ?? null,
  });

  return ok({ tracked: true });
});

import { handle, ok, ApiError } from "@/lib/api";
import { trackOfferClick } from "@/services/offer.service";
import { Offer, AnalyticsEvent } from "@/server/models";
import { getAuthUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";

/** Records a real "Get offer" interaction (addendum #14, #21 — real events only). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new ApiError("NOT_FOUND", "Offer not found", 404);

  enforceRateLimit(req, "offer_click", 60, 60_000);

  const offer = await Offer.findById(id).select("businessId").lean<{ _id: Types.ObjectId; businessId: Types.ObjectId } | null>();
  if (!offer) throw new ApiError("NOT_FOUND", "Offer not found", 404);

  const viewer = await getAuthUser();
  await trackOfferClick(id);
  await AnalyticsEvent.create({
    type: "offer_click",
    userId: viewer?._id ?? null,
    businessId: offer.businessId,
    postId: null,
    productId: null,
    advertisementId: null,
    valueMs: 0,
    country: null,
  });

  return ok({ tracked: true });
});

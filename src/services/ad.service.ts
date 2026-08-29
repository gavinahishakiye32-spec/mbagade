import { Advertisement, BusinessMember, Post, Product, Business } from "@/server/models";
import type { IAdvertisement } from "@/types";
import { ApiError } from "@/lib/api";
import { AD_CPM_CENTS } from "@/config/constants";
import { payments } from "@/services/payment.service";

export interface CreateAdInput {
  type: IAdvertisement["type"];
  postId?: string;
  productId?: string;
  title: string;
  budgetCents: number;
  impressionsGoal: number;
  durationDays: number;
  targeting: { countries: string[]; categories: string[] };
}

export async function createAdvertisement(userId: string, businessId: string, input: CreateAdInput, origin: string) {
  const member = await BusinessMember.exists({ businessId, userId });
  if (!member) throw new ApiError("FORBIDDEN", "You do not manage this business", 403);

  if (input.type === "boost_post" && !input.postId)
    throw new ApiError("INVALID_INPUT", "boost_post requires a postId", 422);
  if (input.type === "product_promo" && !input.productId)
    throw new ApiError("INVALID_INPUT", "product_promo requires a productId", 422);

  if (input.postId) {
    const post = await Post.findOne({ _id: input.postId, businessId, status: "published" }).lean();
    if (!post) throw new ApiError("NOT_FOUND", "Post not found for this business", 404);
  }
  if (input.productId) {
    const product = await Product.findOne({ _id: input.productId, businessId }).lean();
    if (!product) throw new ApiError("NOT_FOUND", "Product not found for this business", 404);
  }

  const ad = await Advertisement.create({
    businessId,
    postId: input.postId ?? null,
    productId: input.productId ?? null,
    type: input.type,
    title: input.title,
    budgetCents: input.budgetCents,
    impressionsGoal: input.impressionsGoal,
    durationDays: input.durationDays,
    targeting: input.targeting,
    endsAt: new Date(Date.now() + input.durationDays * 86_400_000),
    status: "pending_payment",
  });

  const payment = await payments().createPayment({
    purpose: "advertising",
    payerUserId: userId,
    businessId,
    advertisementId: String(ad._id),
    amountCents: input.budgetCents,
    currency: (await Business.findById(businessId).select("currency"))?.currency ?? "USD",
    description: `Advertising campaign: ${input.title}`,
    metadata: { advertisementId: String(ad._id) },
    successUrl: `${origin}/dashboard/advertising?paid=1`,
    cancelUrl: `${origin}/dashboard/advertising?cancelled=1`,
  });

  await Advertisement.updateOne({ _id: ad._id }, { paymentId: payment.paymentId });
  return { advertisement: ad.toObject() as IAdvertisement, paymentId: payment.paymentId, checkoutUrl: payment.checkoutUrl };
}

/** After payment confirmation → move to review queue (admin approves before serving). */
export async function markAdPaid(advertisementId: string): Promise<void> {
  await Advertisement.updateOne(
    { _id: advertisementId, status: "pending_payment" },
    { status: "pending_review" }
  );
}

export async function recordImpression(adId: string): Promise<void> {
  const ad = await Advertisement.findById(adId).select("impressionsGoal impressions budgetCents spentCents");
  if (!ad || ad.status !== "active") return;
  ad.impressions += 1;
  ad.spentCents = Math.min(ad.budgetCents, Math.ceil((ad.impressions / 1000) * AD_CPM_CENTS));
  if (ad.impressions >= ad.impressionsGoal) {
    ad.status = "completed";
  }
  await ad.save();
}

export async function recordClick(adId: string): Promise<void> {
  await Advertisement.updateOne({ _id: adId, status: "active" }, { $inc: { clicks: 1 } });
}

export async function listMyAdvertisements(businessIds: string[]): Promise<IAdvertisement[]> {
  if (businessIds.length === 0) return [];
  return Advertisement.find({ businessId: { $in: businessIds } }).sort({ createdAt: -1 }).limit(100).lean<IAdvertisement[]>();
}

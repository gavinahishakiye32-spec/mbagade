import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { adCreateSchema } from "@/lib/validation";
import { createAdvertisement, listMyAdvertisements } from "@/services/ad.service";
import { BusinessMember } from "@/server/models";
import type { IAdvertisement } from "@/types";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function adView(ad: IAdvertisement) {
  return {
    id: String(ad._id),
    type: ad.type,
    title: ad.title,
    status: ad.status,
    budgetCents: ad.budgetCents,
    spentCents: ad.spentCents,
    impressionsGoal: ad.impressionsGoal,
    impressions: ad.impressions,
    clicks: ad.clicks,
    durationDays: ad.durationDays,
    endsAt: ad.endsAt.toISOString(),
    postId: ad.postId ? String(ad.postId) : null,
    productId: ad.productId ? String(ad.productId) : null,
    createdAt: ad.createdAt.toISOString(),
  };
}

export const GET = handle(async () => {
  await connectDB();
  const user = await requireUser();
  const memberships = await BusinessMember.find({ userId: user._id }).select("businessId").lean();
  const ads = await listMyAdvertisements(memberships.map((m) => String(m.businessId)));
  return ok({ items: ads.map(adView) });
});

/** POST /api/ads?businessId= — create campaign + payment. */
export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const input = await parseJson(req, adCreateSchema);
  const origin = new URL(req.url).origin;
  const url = new URL(req.url);
  let businessId = url.searchParams.get("businessId");
  if (!businessId || !/^[a-f0-9]{24}$/i.test(businessId)) {
    const membership = await BusinessMember.findOne({ userId: user._id }).lean();
    if (!membership) throw new Error("FORBIDDEN");
    businessId = String(membership.businessId);
  }
  const result = await createAdvertisement(String(user._id), businessId, input as never, origin);
  return ok(
    {
      advertisement: adView(result.advertisement),
      paymentId: result.paymentId,
      checkoutUrl: result.checkoutUrl,
    },
    { status: 201 }
  );
});

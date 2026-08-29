import { Types } from "mongoose";
import { Offer, Business, Product } from "@/server/models";
import type { IBusiness, IOffer, IProduct, OfferView } from "@/types";
import { ApiError } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import type { OfferAvailability } from "@/config/constants";

/**
 * Business offers & promotions (development addendum #14).
 * Offers connect to the existing commerce system via productId and are
 * discoverable through /offers, business profiles and nearby filters.
 */

/** Pure helper — derives display availability from stored status + date window. */
export function offerAvailability(
  status: "draft" | "active" | "paused",
  startsAt: Date,
  endsAt: Date,
  nowMs: number = Date.now()
): OfferAvailability {
  if (status === "draft") return "draft";
  if (status === "paused") return "paused";
  if (nowMs < startsAt.getTime()) return "scheduled";
  if (nowMs > endsAt.getTime()) return "expired";
  return "active";
}

function toOfferView(offer: IOffer, business: IBusiness): OfferView {
  return {
    id: String(offer._id),
    business: {
      id: String(business._id),
      username: business.username,
      name: business.name,
      logoUrl: mediaUrl(business.logoKey),
      verified: business.verification === "verified",
      founding: business.isFoundingBusiness,
      category: business.category,
      city: business.city,
      country: business.country,
    },
    title: offer.title,
    description: offer.description,
    imageUrl: offer.mediaKeys.length > 0 ? mediaUrl(offer.mediaKeys[0]!) : null,
    discountLabel: offer.discountLabel,
    priceCents: offer.priceCents,
    currency: offer.currency,
    productId: offer.productId ? String(offer.productId) : null,
    terms: offer.terms,
    status: offer.status,
    startsAt: offer.startsAt.toISOString(),
    endsAt: offer.endsAt.toISOString(),
    city: offer.city ?? business.city,
    country: offer.country ?? business.country,
    availability: offerAvailability(offer.status, offer.startsAt, offer.endsAt),
    clicksCount: offer.clicksCount,
    createdAt: offer.createdAt.toISOString(),
  };
}

export interface CreateOfferInput {
  title: string;
  description?: string;
  mediaKeys?: string[];
  discountLabel: string;
  priceCents?: number | null;
  currency?: string | null;
  productId?: string | null;
  terms?: string;
  startsAt: string;
  endsAt: string;
  status?: "draft" | "active" | "paused";
}

export async function createOffer(businessId: string, input: CreateOfferInput): Promise<IOffer> {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new ApiError("VALIDATION_ERROR", "Invalid start/end date", 422);
  }
  if (endsAt <= startsAt) throw new ApiError("VALIDATION_ERROR", "End date must be after start date", 422);

  let productId: Types.ObjectId | null = null;
  if (input.productId) {
    const product = await Product.findOne({ _id: input.productId, businessId }).lean<IProduct>();
    if (!product) throw new ApiError("NOT_FOUND", "Linked product not found for this business", 404);
    productId = new Types.ObjectId(input.productId);
  }

  const business = await Business.findById(businessId).select("city country currency").lean<IBusiness>();
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);

  return Offer.create({
    businessId,
    title: input.title,
    description: input.description ?? "",
    mediaKeys: input.mediaKeys ?? [],
    discountLabel: input.discountLabel,
    priceCents: input.priceCents ?? null,
    currency: input.currency ?? business.currency,
    productId,
    terms: input.terms ?? "",
    startsAt,
    endsAt,
    city: business.city,
    country: business.country,
    status: input.status ?? "active",
  });
}

export async function updateOffer(
  businessId: string,
  offerId: string,
  patch: Partial<CreateOfferInput>
): Promise<IOffer> {
  const offer = await Offer.findOne({ _id: offerId, businessId });
  if (!offer) throw new ApiError("NOT_FOUND", "Offer not found", 404);

  if (patch.title !== undefined) offer.title = patch.title;
  if (patch.description !== undefined) offer.description = patch.description;
  if (patch.mediaKeys !== undefined) offer.mediaKeys = patch.mediaKeys;
  if (patch.discountLabel !== undefined) offer.discountLabel = patch.discountLabel;
  if (patch.priceCents !== undefined) offer.priceCents = patch.priceCents;
  if (patch.currency !== undefined) offer.currency = patch.currency;
  if (patch.terms !== undefined) offer.terms = patch.terms;
  if (patch.status !== undefined) offer.status = patch.status;
  if (patch.productId !== undefined) {
    if (patch.productId === null) {
      offer.productId = null;
    } else {
      const product = await Product.findOne({ _id: patch.productId, businessId }).lean<IProduct>();
      if (!product) throw new ApiError("NOT_FOUND", "Linked product not found for this business", 404);
      offer.productId = new Types.ObjectId(patch.productId);
    }
  }
  if (patch.startsAt !== undefined) {
    const d = new Date(patch.startsAt);
    if (Number.isNaN(d.getTime())) throw new ApiError("VALIDATION_ERROR", "Invalid start date", 422);
    offer.startsAt = d;
  }
  if (patch.endsAt !== undefined) {
    const d = new Date(patch.endsAt);
    if (Number.isNaN(d.getTime())) throw new ApiError("VALIDATION_ERROR", "Invalid end date", 422);
    offer.endsAt = d;
  }
  if (offer.endsAt <= offer.startsAt) throw new ApiError("VALIDATION_ERROR", "End date must be after start date", 422);

  await offer.save();
  return offer;
}

export async function deleteOffer(businessId: string, offerId: string): Promise<void> {
  const result = await Offer.deleteOne({ _id: offerId, businessId });
  if (result.deletedCount === 0) throw new ApiError("NOT_FOUND", "Offer not found", 404);
}

export async function listBusinessOffers(businessId: string): Promise<OfferView[]> {
  const [offers, business] = await Promise.all([
    Offer.find({ businessId }).sort({ createdAt: -1 }).limit(100),
    Business.findById(businessId).lean<IBusiness>(),
  ]);
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);
  return offers.map((o) => toOfferView(o, business));
}

export interface PublicOfferFilter {
  businessId?: string;
  city?: string;
  country?: string;
  category?: string;
  includePaused?: boolean; // owner dashboard view
  limit?: number;
}

export async function listPublicOffers(filter: PublicOfferFilter): Promise<OfferView[]> {
  const now = new Date();
  const match: Record<string, unknown> = {};
  if (filter.businessId) match.businessId = new Types.ObjectId(filter.businessId);
  if (filter.city) match.city = filter.city;
  if (filter.country) match.country = filter.country;

  // Only live windows by default — expired/scheduled stay out of public discovery.
  if (!filter.includePaused) {
    match.status = "active";
    match.startsAt = { $lte: now };
    match.endsAt = { $gte: now };
  }

  const limit = Math.min(filter.limit ?? 30, 100);

  let businessIds: Types.ObjectId[] | null = null;
  if (filter.category) {
    const biz = await Business.find({ category: filter.category, status: "active" })
      .select("_id")
      .limit(2000)
      .lean<IBusiness[]>();
    businessIds = biz.map((b) => b._id as Types.ObjectId);
    match.businessId = filter.businessId
      ? { $in: [new Types.ObjectId(filter.businessId)] }
      : { $in: businessIds };
  }

  const offers = await Offer.find(match)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate<{ businessId: IBusiness }>("businessId");

  const views = offers
    .filter((o) => o.businessId && typeof o.businessId === "object" && (o.businessId as IBusiness)._id)
    .map((o) => toOfferView(o as unknown as IOffer, o.businessId as unknown as IBusiness));

  return views.filter((v) => v.availability === "active");
}

export async function trackOfferClick(offerId: string): Promise<void> {
  await Offer.updateOne({ _id: offerId }, { $inc: { clicksCount: 1 } });
}

import { AnalyticsEvent, Post, Business, Order } from "@/server/models";
import { Types } from "mongoose";

type EventType =
  | "post_view"
  | "profile_visit"
  | "product_click"
  | "contact_click"
  | "website_click"
  | "whatsapp_click"
  | "call_click"
  | "message_click"
  | "offer_click"
  | "follow"
  | "share"
  | "ad_impression"
  | "ad_click"
  | "order_created";

export interface TrackInput {
  type: EventType;
  userId?: string | null;
  businessId?: string | Types.ObjectId | null;
  postId?: string | Types.ObjectId | null;
  productId?: string | Types.ObjectId | null;
  advertisementId?: string | Types.ObjectId | null;
  valueMs?: number;
  country?: string | null;
}

/** Fire-and-forget event tracking. Never blocks the request path on failure. */
export function track(input: TrackInput): void {
  void AnalyticsEvent.create({
    type: input.type,
    userId: input.userId ?? null,
    businessId: input.businessId ?? null,
    postId: input.postId ?? null,
    productId: input.productId ?? null,
    advertisementId: input.advertisementId ?? null,
    valueMs: input.valueMs ?? 0,
    country: input.country ?? null,
  }).catch((err) => console.error("[analytics]", err));
}

export interface DaySeriesPoint {
  date: string;
  value: number;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function dailySeries(
  businessId: string,
  types: string[],
  days: number
): Promise<DaySeriesPoint[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const results = await AnalyticsEvent.aggregate<{ _id: string; count: number }>([
    { $match: { businessId: new Types.ObjectId(businessId), type: { $in: types }, createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
  ]);
  const map = new Map(results.map((r) => [r._id, r.count]));
  const out: DaySeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(new Date(Date.now() - i * 86_400_000));
    out.push({ date: key, value: map.get(key) ?? 0 });
  }
  return out;
}

export interface BusinessAnalyticsSummary {
  totals: {
    views: number;
    profileVisits: number;
    productClicks: number;
    contactClicks: number;
    messageClicks: number;
    callClicks: number;
    offerClicks: number;
    websiteClicks: number;
    whatsappClicks: number;
    followers: number;
    posts: number;
    products: number;
    orders: number;
    revenueCents: number;
  };
  series: {
    views: DaySeriesPoint[];
    contactClicks: DaySeriesPoint[];
    profileVisits: DaySeriesPoint[];
    followers: DaySeriesPoint[];
  };
  topPosts: { id: string; caption: string; views: number; likes: number; comments: number; saves: number }[];
}

export async function businessSummary(businessId: string, days = 30): Promise<BusinessAnalyticsSummary> {
  const oid = new Types.ObjectId(businessId);
  const since = new Date(Date.now() - days * 86_400_000);

  const [business, eventTotals, ordersAgg, viewsSeries, contactSeries, visitSeries, followerSeries, topPosts] =
    await Promise.all([
      Business.findById(oid).select("followersCount postsCount productsCount websiteClicks whatsappClicks contactClicks").lean(),
      AnalyticsEvent.aggregate<{ _id: string; count: number }>([
        { $match: { businessId: oid, createdAt: { $gte: since } } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      Order.aggregate<{ count: number; revenue: number }>([
        { $match: { businessId: oid, status: { $in: ["paid", "processing", "shipped", "delivered"] } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$totalCents" } } },
      ]),
      dailySeries(businessId, ["post_view"], days),
      dailySeries(businessId, ["contact_click", "call_click", "message_click"], days),
      dailySeries(businessId, ["profile_visit"], days),
      AnalyticsEvent.aggregate<{ _id: string; count: number }>([
        { $match: { businessId: oid, type: "follow", createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      ]),
      Post.find({ businessId: oid, status: "published" })
        .sort({ viewsCount: -1 })
        .limit(5)
        .select("caption viewsCount likesCount commentsCount savesCount")
        .lean(),
    ]);

  const totalsMap = Object.fromEntries(eventTotals.map((e) => [e._id, e.count]));
  const followerMap = new Map(followerSeries.map((f) => [f._id, f.count]));

  const followersDaily: DaySeriesPoint[] = [];
  const totalFollowEvents = totalsMap["follow"] ?? 0;
  let running = Math.max(0, (business?.followersCount ?? 0) - totalFollowEvents);
  for (const p of dailySeriesEmpty(days)) {
    running += followerMap.get(p) ?? 0;
    followersDaily.push({ date: p, value: running });
  }

  return {
    totals: {
      views: totalsMap["post_view"] ?? 0,
      profileVisits: totalsMap["profile_visit"] ?? 0,
      productClicks: totalsMap["product_click"] ?? 0,
      contactClicks: (totalsMap["contact_click"] ?? 0) + (totalsMap["call_click"] ?? 0) + (totalsMap["message_click"] ?? 0),
      messageClicks: totalsMap["message_click"] ?? 0,
      callClicks: totalsMap["call_click"] ?? 0,
      offerClicks: totalsMap["offer_click"] ?? 0,
      websiteClicks: business?.websiteClicks ?? 0,
      whatsappClicks: business?.whatsappClicks ?? 0,
      followers: business?.followersCount ?? 0,
      posts: business?.postsCount ?? 0,
      products: business?.productsCount ?? 0,
      orders: ordersAgg[0]?.count ?? 0,
      revenueCents: ordersAgg[0]?.revenue ?? 0,
    },
    series: {
      views: viewsSeries,
      contactClicks: contactSeries,
      profileVisits: visitSeries,
      followers: followersDaily,
    },
    topPosts: topPosts.map((p) => ({
      id: String(p._id),
      caption: p.caption.slice(0, 80),
      views: p.viewsCount,
      likes: p.likesCount,
      comments: p.commentsCount,
      saves: p.savesCount,
    })),
  };
}

function dailySeriesEmpty(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(dayKey(new Date(Date.now() - i * 86_400_000)));
  return out;
}

import { User, Business, Post, Order, Report, Advertisement, AuditLog, AnalyticsEvent } from "@/server/models";

export async function auditLog(
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  detail: Record<string, unknown> = {}
): Promise<void> {
  await AuditLog.create({
    actorUserId,
    action,
    targetType,
    targetId: targetId ?? null,
    detail,
  }).catch((err) => console.error("[audit]", err));
}

export interface AdminStats {
  users: { total: number; customers: number; businessOwners: number; suspended: number; banned: number; newToday: number };
  businesses: { total: number; verified: number; pendingVerification: number; suspended: number };
  content: { posts: number; underReview: number; openReports: number };
  commerce: { orders: number; paidOrders: number; gmvCents: number; platformFeesCents: number };
  ads: { active: number; pendingReview: number };
  activity: { events7d: number };
}

export async function adminStats(): Promise<AdminStats> {
  const dayAgo = new Date(Date.now() - 86_400_000);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [
    totalUsers, customers, businessOwners, suspended, banned, newToday,
    totalBusinesses, verified, pendingVerification, suspendedBiz,
    posts, underReview, openReports,
    orders, paidAgg,
    activeAds, pendingAds,
    events7d,
  ] = await Promise.all([
    User.countDocuments({ status: { $ne: "deleted" } }),
    User.countDocuments({ role: "customer", status: { $ne: "deleted" } }),
    User.countDocuments({ role: "business", status: { $ne: "deleted" } }),
    User.countDocuments({ status: "suspended" }),
    User.countDocuments({ status: "banned" }),
    User.countDocuments({ createdAt: { $gte: dayAgo } }),
    Business.countDocuments(),
    Business.countDocuments({ verification: "verified" }),
    Business.countDocuments({ verification: "pending" }),
    Business.countDocuments({ status: "suspended" }),
    Post.countDocuments({ status: { $ne: "removed" } }),
    Post.countDocuments({ status: "under_review" }),
    Report.countDocuments({ status: "open" }),
    Order.countDocuments(),
    Order.aggregate<{ count: number; gmv: number; fees: number }>([
      { $match: { status: { $in: ["paid", "processing", "shipped", "delivered"] } } },
      { $group: { _id: null, count: { $sum: 1 }, gmv: { $sum: "$subtotalCents" }, fees: { $sum: "$feeCents" } } },
    ]),
    Advertisement.countDocuments({ status: "active" }),
    Advertisement.countDocuments({ status: "pending_review" }),
    AnalyticsEvent.countDocuments({ createdAt: { $gte: weekAgo } }),
  ]);

  return {
    users: { total: totalUsers, customers, businessOwners, suspended, banned, newToday },
    businesses: { total: totalBusinesses, verified, pendingVerification, suspended: suspendedBiz },
    content: { posts, underReview, openReports },
    commerce: { orders, paidOrders: paidAgg[0]?.count ?? 0, gmvCents: paidAgg[0]?.gmv ?? 0, platformFeesCents: paidAgg[0]?.fees ?? 0 },
    ads: { active: activeAds, pendingReview: pendingAds },
    activity: { events7d },
  };
}

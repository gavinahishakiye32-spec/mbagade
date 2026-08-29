import { Types, QueryFilter } from "mongoose";
import { Business, BusinessMember, Follow, Review, User, Block } from "@/server/models";
import type { IBusiness, IBusinessMember } from "@/types";
import { ApiError } from "@/lib/api";
import { businessAccessFor } from "@/lib/permissions";
import type { SafeUser } from "@/types";
import { notify } from "@/services/notification.service";
import { track } from "@/services/analytics.service";

export interface CreateBusinessInput {
  name: string;
  username: string;
  description: string;
  category: string;
  subcategory?: string;
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
  currency?: string;
  latitude?: number;
  longitude?: number;
}

export async function createBusiness(user: SafeUser, input: CreateBusinessInput): Promise<IBusiness> {
  const existing = await Business.findOne({ username: input.username.toLowerCase() }).lean();
  if (existing) throw new ApiError("USERNAME_TAKEN", "This business username is already taken", 409);

  const business = await Business.create({
    ownerUserId: new Types.ObjectId(String(user._id)),
    username: input.username.toLowerCase(),
    name: input.name,
    description: input.description ?? "",
    category: input.category,
    subcategory: input.subcategory ?? "",
    country: input.country || null,
    region: input.region || null,
    city: input.city || null,
    address: input.address || null,
    phone: input.phone || null,
    email: input.email || null,
    whatsapp: input.whatsapp || null,
    website: input.website || null,
    currency: input.currency ?? "USD",
    location:
      input.latitude != null && input.longitude != null
        ? { type: "Point" as const, coordinates: [input.longitude, input.latitude] }
        : null,
  });

  await BusinessMember.create({
    businessId: business._id,
    userId: user._id,
    role: "owner",
  });

  if (user.role === "customer") {
    await User.updateOne({ _id: user._id }, { $set: { role: "business" } });
  }

  // Launch-phase founding auto-grant (addendum #7) — config-driven window.
  const { maybeAutoGrantFounding } = await import("@/services/growth.service");
  await maybeAutoGrantFounding("business", business);

  return business;
}

export async function getBusinessByUsername(username: string): Promise<IBusiness | null> {
  return Business.findOne({ username: username.toLowerCase(), status: { $ne: "suspended" } }).lean();
}

export async function getBusinessById(id: string): Promise<IBusiness | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return Business.findById(id).lean();
}

export async function updateBusiness(actor: SafeUser, businessId: string, patch: Record<string, unknown>): Promise<IBusiness> {
  const access = await memberRole(actor, businessId);
  if (!access.canManage) throw new ApiError("FORBIDDEN", "You cannot edit this business", 403);

  const allowed = [
    "name",
    "description",
    "logoKey",
    "coverKey",
    "category",
    "subcategory",
    "country",
    "region",
    "city",
    "address",
    "phone",
    "email",
    "whatsapp",
    "website",
    "socialLinks",
    "openingHours",
    "allowCalls",
    "allowOrders",
    "currency",
  ];
  const $set: Record<string, unknown> = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) $set[key] = patch[key];
  }
  if (patch.latitude != null && patch.longitude != null) {
    $set.location = { type: "Point", coordinates: [patch.longitude as number, patch.latitude as number] };
  }

  const updated = await Business.findByIdAndUpdate(businessId, { $set }, { new: true }).lean();
  if (!updated) throw new ApiError("NOT_FOUND", "Business not found", 404);
  return updated;
}

export async function memberRole(user: SafeUser | null, businessId: string): Promise<{ isOwner: boolean; canManage: boolean; canModerate: boolean; role: string | null }> {
  if (!user) return { isOwner: false, canManage: false, canModerate: false, role: null };
  if (user.role === "admin") return { isOwner: true, canManage: true, canModerate: true, role: "owner" };
  const member = await BusinessMember.findOne({ businessId, userId: user._id }).lean<IBusinessMember | null>();
  const access = businessAccessFor(user, member?.role ?? null, "");
  return { isOwner: access.isOwner, canManage: access.canManage, canModerate: access.canModerate, role: access.role };
}

/* ---------- Follow ---------- */

export async function toggleFollow(userId: string, businessId: string): Promise<{ following: boolean; followersCount: number }> {
  const business = await Business.findOne({ _id: businessId, status: "active" }).select("_id ownerUserId name");
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);

  const existing = await Follow.findOne({ userId, businessId, followingType: "business" });
  if (existing) {
    await existing.deleteOne();
    const updated = await Business.findByIdAndUpdate(businessId, { $inc: { followersCount: -1 } }, { new: true }).select("followersCount");
    return { following: false, followersCount: updated?.followersCount ?? 0 };
  }

  await Follow.create({ userId, businessId, followedUserId: null, followingType: "business" });
  const updated = await Business.findByIdAndUpdate(businessId, { $inc: { followersCount: 1 } }, { new: true }).select("followersCount");

  void track({ type: "follow", userId, businessId });
  // attribute follow to recent posts of this business (viral signal)
  const { Post } = await import("@/server/models");
  await Post.updateMany(
    { businessId: business._id, createdAt: { $gte: new Date(Date.now() - 7 * 86_400_000) } },
    { $inc: { followsGenerated: 1 } }
  );

  const isOwner = String(business.ownerUserId) !== userId;
  if (isOwner) {
    await notify({
      userId: business.ownerUserId,
      type: "new_follower",
      title: "New follower",
      body: `Someone started following ${business.name}`,
      url: `/businesses/${business.username}`,
      actorUserId: userId,
      businessId: business._id,
    });
  }
  return { following: true, followersCount: updated?.followersCount ?? 0 };
}

export async function isFollowing(userId: string | null, businessId: string): Promise<boolean> {
  if (!userId) return false;
  return Boolean(await Follow.exists({ userId, businessId, followingType: "business" }));
}

/* ---------- Reviews ---------- */

export async function addReview(userId: string, businessId: string, rating: number, text: string) {
  const business = await Business.findOne({ _id: businessId, status: "active" }).select("_id ownerUserId");
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);
  if (String(business.ownerUserId) === userId) throw new ApiError("INVALID_INPUT", "You cannot review your own business", 422);

  const existing = await Review.findOne({ businessId, userId }).lean();
  if (existing) throw new ApiError("ALREADY_REVIEWED", "You already reviewed this business", 409);

  await Review.create({ businessId, userId, rating, text });
  await recalcRating(businessId);

  await notify({
    userId: business.ownerUserId,
    type: "review",
    title: `New ${rating}-star review`,
    body: text.slice(0, 120),
    url: `/businesses/${(await Business.findById(businessId).select("username"))?.username}`,
    actorUserId: userId,
    businessId,
  });
}

export async function recalcRating(businessId: string): Promise<void> {
  const agg = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { businessId: new Types.ObjectId(businessId), status: "visible" } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Business.updateOne(
    { _id: businessId },
    { ratingAvg: agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0, reviewsCount: agg[0]?.count ?? 0 }
  );
}

export interface ReviewView {
  id: string;
  rating: number;
  text: string;
  author: { name: string; username: string };
  createdAt: string;
}

export async function listReviews(businessId: string, cursor: string | null, limit: number): Promise<{ items: ReviewView[]; nextCursor: string | null }> {
  const filter: QueryFilter<{ businessId: string; status: string; _id?: unknown }> = { businessId, status: "visible" };
  if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

  const reviews = (await Review.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate("userId", "name username")
    .lean()) as unknown as ({ _id: Types.ObjectId; rating: number; text: string; createdAt: Date; userId: { name: string; username: string } })[];

  const hasMore = reviews.length > limit;
  const page = hasMore ? reviews.slice(0, limit) : reviews;
  return {
    items: page.map((r) => ({
      id: String(r._id),
      rating: r.rating,
      text: r.text,
      author: { name: r.userId.name, username: r.userId.username },
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor: hasMore && page.length > 0 ? String(page[page.length - 1]._id) : null,
  };
}

/* ---------- Members ---------- */

export async function addMember(owner: SafeUser, businessId: string, email: string, role: "manager" | "editor") {
  const access = await memberRole(owner, businessId);
  if (!access.isOwner) throw new ApiError("FORBIDDEN", "Only the business owner can manage members", 403);

  const target = await User.findOne({ email }).lean();
  if (!target) throw new ApiError("USER_NOT_FOUND", "No platform account with that email yet", 404);

  const business = await Business.findById(businessId).select("ownerUserId").lean();
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);
  if (String(business.ownerUserId) === String(target._id)) throw new ApiError("INVALID_INPUT", "Owner is already a member", 422);

  const exists = await BusinessMember.findOne({ businessId, userId: target._id }).lean();
  if (exists) throw new ApiError("ALREADY_MEMBER", "User is already a member", 409);

  await BusinessMember.create({ businessId, userId: target._id, role, invitedByUserId: owner._id });
}

export async function listMembers(businessId: string) {
  const members = (await BusinessMember.find({ businessId })
    .populate("userId", "name email avatarKey")
    .lean()) as unknown as ({ _id: Types.ObjectId; role: string; createdAt: Date; userId: { name: string; email: string } })[];
  return members.map((m) => ({
    id: String(m._id),
    role: m.role,
    name: m.userId.name,
    email: m.userId.email,
    joinedAt: m.createdAt.toISOString(),
  }));
}

export async function removeMember(actor: SafeUser, businessId: string, memberId: string) {
  const access = await memberRole(actor, businessId);
  if (!access.isOwner) throw new ApiError("FORBIDDEN", "Only the business owner can manage members", 403);
  await BusinessMember.deleteOne({ _id: memberId, businessId });
}

/* ---------- Blocking ---------- */

export async function toggleBlock(userId: string, targetUserId: string): Promise<{ blocked: boolean }> {
  if (userId === targetUserId) throw new ApiError("INVALID_INPUT", "You cannot block yourself", 422);
  const existing = await Block.findOne({ blockerId: userId, blockedId: targetUserId });
  if (existing) {
    await existing.deleteOne();
    return { blocked: false };
  }
  await Block.create({ blockerId: userId, blockedId: targetUserId });
  return { blocked: true };
}

export async function blockedBy(viewerId: string | null): Promise<Set<string>> {
  if (!viewerId) return new Set();
  const blocks = await Block.find({ blockerId: viewerId }).select("blockedId").lean();
  return new Set(blocks.map((b) => String(b.blockedId)));
}

import type { Types } from "mongoose";
import type {
  BusinessMemberRole,
  ClaimStatus,
  CurrencyCode,
  NotificationType,
  OfferStatus,
  OrderStatus,
  ReferralType,
  ReportReason,
  UserRole,
  VerificationState,
  WaitlistStatus,
  WaitlistType,
} from "@/config/constants";

/* ---------- User ---------- */

export interface OAuthAccount {
  provider: "google" | "facebook";
  providerAccountId: string;
  email?: string;
  linkedAt: Date;
}

export interface IUser {
  _id: Types.ObjectId;
  username: string;
  email: string;
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  name: string;
  avatarKey: string | null;
  bio: string;
  country: string | null;
  city: string | null;
  role: UserRole;
  oauthAccounts: OAuthAccount[];
  lastLoginAt: Date | null;
  loginFailures: { count: number; lockedUntil: Date | null };
  status: "active" | "suspended" | "banned" | "deleted";
  suspendedReason: string | null;
  /** Launch-phase recognition (addendum #8) — configurable, admin-granted. */
  isFoundingCustomer: boolean;
  foundingCustomerAt: Date | null;
  /** Lazy-generated personal invite code for the referral system (addendum #18). */
  referralCode: string | null;
  referredByUserId: Types.ObjectId | null;
  /** Denormalized followers/posts counters so personal creators can be followed (addendum). */
  followersCount: number;
  postsCount: number;
  settings: {
    notifications: Record<NotificationType, boolean>;
    allowCalls: boolean;
    allowMessagesFromAnyone: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type SafeUser = Omit<IUser, "passwordHash" | "loginFailures">;

/* ---------- Business ---------- */

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface OpeningHoursDay {
  open: string; // "09:00"
  close: string; // "18:00"
  closed: boolean;
}

export interface IBusiness {
  _id: Types.ObjectId;
  ownerUserId: Types.ObjectId;
  username: string;
  name: string;
  description: string;
  logoKey: string | null;
  coverKey: string | null;
  category: string;
  subcategory: string;
  country: string | null;
  region: string | null;
  city: string | null;
  address: string | null;
  location: GeoPoint | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
  socialLinks: { platform: string; url: string }[];
  openingHours: OpeningHoursDay[] | null;
  verification: VerificationState;
  verifiedAt: Date | null;
  followersCount: number;
  postsCount: number;
  productsCount: number;
  ratingAvg: number;
  reviewsCount: number;
  viewsCount: number;
  contactClicks: number;
  websiteClicks: number;
  whatsappClicks: number;
  allowCalls: boolean;
  allowOrders: boolean;
  currency: CurrencyCode;
  status: "active" | "suspended";
  /** Launch-phase recognition (addendum #7) — configurable, admin-granted. */
  isFoundingBusiness: boolean;
  foundingBusinessAt: Date | null;
  /**
   * Assisted-onboarding lifecycle (addendum #9/#10): businesses created by admin
   * before an owner registers start as "unclaimed" and go "pending" while a claim
   * is reviewed. Self-registered businesses are "claimed" from birth ("n/a" is
   * used for legacy rows created before this field existed).
   */
  claimStatus: ClaimStatus;
  createdByAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBusinessMember {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  role: BusinessMemberRole;
  invitedByUserId: Types.ObjectId | null;
  createdAt: Date;
}

export interface ICategory {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  icon: string;
  active: boolean;
  order: number;
}

export interface IVerificationRequest {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  submittedByUserId: Types.ObjectId;
  documents: { type: string; fileKey: string; label: string }[];
  registrationNumber: string;
  note: string;
  status: "pending" | "approved" | "rejected";
  reviewedByUserId: Types.ObjectId | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

/* ---------- Content ---------- */

export type PostType = "text" | "image" | "video";

export type PostAuthorType = "user" | "business";

export interface IPost {
  _id: Types.ObjectId;
  /** 0 if the post belongs to a personal creator (authorType === "user"). */
  businessId: Types.ObjectId | null;
  authorUserId: Types.ObjectId;
  authorType: PostAuthorType;
  type: PostType;
  caption: string;
  hashtags: string[];
  mediaKeys: string[];
  thumbnailKey: string | null;
  /** The sound/music attached to this post (TikTok-style audio), if any. */
  soundId: Types.ObjectId | null;
  productIds: Types.ObjectId[];
  city: string | null;
  country: string | null;
  location: GeoPoint | null;
  visibility: "public" | "followers";
  status: "published" | "under_review" | "removed";
  moderation: { source: "ai" | "keyword" | "admin"; flagged: boolean; reasons: string[] } | null;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  followsGenerated: number;
  productClicks: number;
  contactClicks: number;
  reportsCount: number;
  scoreCache: number;
  scoreUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IComment {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  text: string;
  status: "visible" | "removed";
  likesCount: number;
  repliesCount: number;
  createdAt: Date;
}

export interface ILike {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  createdAt: Date;
}

export type FollowingType = "user" | "business";

export interface IFollow {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** The followed business when followingType === "business", else null. */
  businessId: Types.ObjectId | null;
  /** The followed user when followingType === "user", else null. */
  followedUserId: Types.ObjectId | null;
  followingType: FollowingType;
  createdAt: Date;
}

export interface ISavedPost {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  createdAt: Date;
}

export interface IReview {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  orderId: Types.ObjectId | null;
  rating: number;
  text: string;
  status: "visible" | "removed";
  createdAt: Date;
}

export interface IBlock {
  _id: Types.ObjectId;
  blockerId: Types.ObjectId;
  blockedId: Types.ObjectId;
  createdAt: Date;
}

/* ---------- Sounds / audio (TikTok-style sound library) ---------- */

export interface ISound {
  _id: Types.ObjectId;
  /** Creator that uploaded the sound (can be null for official/curated sounds). */
  creatorUserId: Types.ObjectId | null;
  /** The business this sound is official to, when uploaded by a business. */
  businessId: Types.ObjectId | null;
  title: string;
  artist: string;
  /** Storage key of the audio file (folder "sounds"). */
  audioKey: string;
  /** Storage key of the thumbnail/cover art, if any. */
  coverKey: string | null;
  /** Number of posts that have used this sound. */
  usesCount: number;
  /** Approximate audio duration in seconds, when available. */
  durationSec: number;
  /** Whether this is an official/curated platform sound. */
  official: boolean;
  status: "active" | "hidden" | "removed";
  createdAt: Date;
  updatedAt: Date;
}

export interface SoundView {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl: string | null;
  usesCount: number;
  durationSec: number;
  official: boolean;
  creator: { id: string; name: string; username: string; avatarUrl: string | null } | null;
  createdAt: string;
}

/* ---------- Commerce ---------- */

export interface IProduct {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  kind: "product" | "service";
  name: string;
  description: string;
  imageKeys: string[];
  videoKey: string | null;
  priceCents: number;
  currency: CurrencyCode;
  stock: number | null; // null = unlimited (services)
  category: string;
  variants: { name: string; options: string[] }[];
  available: boolean;
  status: "active" | "hidden" | "removed";
  viewsCount: number;
  ordersCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: Types.ObjectId;
  name: string;
  priceCents: number;
  quantity: number;
}

export interface IOrder {
  _id: Types.ObjectId;
  reference: string;
  customerId: Types.ObjectId;
  businessId: Types.ObjectId;
  items: OrderItem[];
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
  currency: CurrencyCode;
  status: OrderStatus;
  paymentId: Types.ObjectId | null;
  customerContact: { name: string; phone?: string; email?: string; address?: string; note?: string };
  statusHistory: { status: OrderStatus; at: Date; byUserId: Types.ObjectId | null }[];
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentPurpose = "order" | "advertising" | "subscription" | "featured";

export interface IPayment {
  _id: Types.ObjectId;
  purpose: PaymentPurpose;
  payerUserId: Types.ObjectId;
  businessId: Types.ObjectId | null;
  orderId: Types.ObjectId | null;
  advertisementId: Types.ObjectId | null;
  subscriptionId: Types.ObjectId | null;
  provider: string;
  providerRef: string | null;
  amountCents: number;
  feeCents: number;
  currency: CurrencyCode;
  status: "pending" | "paid" | "failed" | "refunded" | "cancelled";
  description: string;
  metadata: Record<string, string>;
  refundedCents: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscription {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  planId: string;
  status: "active" | "cancelled" | "expired";
  startedAt: Date;
  currentPeriodEnd: Date;
  paymentId: Types.ObjectId | null;
  createdAt: Date;
}

/* ---------- Advertising ---------- */

export interface IAdvertisement {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  postId: Types.ObjectId | null;
  productId: Types.ObjectId | null;
  type: "boost_post" | "sponsored_business" | "product_promo";
  title: string;
  budgetCents: number;
  spentCents: number;
  impressionsGoal: number;
  impressions: number;
  clicks: number;
  targeting: { countries: string[]; categories: string[] };
  durationDays: number;
  startsAt: Date;
  endsAt: Date;
  status: "pending_payment" | "pending_review" | "active" | "paused" | "completed" | "rejected";
  rejectionNote: string | null;
  paymentId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

/* ---------- Messaging ---------- */

export interface IConversation {
  _id: Types.ObjectId;
  userSideId: Types.ObjectId; // the customer user
  businessId: Types.ObjectId;
  lastMessage: { text: string; senderType: "user" | "business"; at: Date } | null;
  unreadForUser: number;
  unreadForBusiness: number;
  archivedByUser: boolean;
  archivedByBusiness: boolean;
  lastMessageAt: Date;
  createdAt: Date;
}

export interface IMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderUserId: Types.ObjectId;
  senderType: "user" | "business";
  text: string;
  mediaKey: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/* ---------- Calls ---------- */

export interface ICall {
  _id: Types.ObjectId;
  callerUserId: Types.ObjectId;
  calleeUserId: Types.ObjectId;
  businessId: Types.ObjectId | null;
  type: "voice" | "video";
  status: "ringing" | "accepted" | "rejected" | "ended" | "missed" | "cancelled";
  startedAt: Date | null;
  endedAt: Date | null;
  durationSec: number;
  createdAt: Date;
}

export interface ICallSignal {
  _id: Types.ObjectId;
  callId: Types.ObjectId;
  fromUserId: Types.ObjectId;
  payload: { kind: "offer" | "answer" | "candidate"; data: unknown };
  createdAt: Date;
}

/* ---------- Live ---------- */

export interface ILiveStream {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  title: string;
  embedUrl: string;
  thumbnailKey: string | null;
  status: "live" | "ended";
  viewers: number;
  peakViewers: number;
  messagesCount: number;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
}

export interface ILiveMessage {
  _id: Types.ObjectId;
  liveStreamId: Types.ObjectId;
  userId: Types.ObjectId;
  text: string;
  createdAt: Date;
}

/* ---------- Growth: offers, referrals, waitlist, claims (addendum) ---------- */

export interface IOffer {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  title: string;
  description: string;
  mediaKeys: string[];
  /** Human-facing discount label, e.g. "20% OFF" or "Buy 2, Get 1 Free". */
  discountLabel: string;
  priceCents: number | null;
  currency: CurrencyCode | null;
  productId: Types.ObjectId | null;
  terms: string;
  startsAt: Date;
  endsAt: Date;
  city: string | null;
  country: string | null;
  status: OfferStatus; // draft/active/paused — "expired"/"scheduled" are derived from dates
  clicksCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReferral {
  _id: Types.ObjectId;
  type: ReferralType;
  referrerUserId: Types.ObjectId;
  code: string;
  invitedEmail: string | null;
  referredUserId: Types.ObjectId | null;
  status: "pending" | "completed" | "rewarded";
  completedAt: Date | null;
  rewardedAt: Date | null;
  createdAt: Date;
}

export interface IWaitlistEntry {
  _id: Types.ObjectId;
  type: WaitlistType;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  city: string | null;
  businessName: string | null;
  category: string | null;
  status: WaitlistStatus;
  userId: Types.ObjectId | null; // set when the entry converts into a real account
  createdAt: Date;
}

export interface IClaimRequest {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  note: string;
  docFileKey: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  reviewedByUserId: Types.ObjectId | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

/* ---------- Platform ---------- */

export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  actorUserId: Types.ObjectId | null;
  businessId: Types.ObjectId | null;
  postId: Types.ObjectId | null;
  entityId: Types.ObjectId | null;
  title: string;
  body: string;
  url: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface IReport {
  _id: Types.ObjectId;
  reporterId: Types.ObjectId;
  targetType: "post" | "comment" | "business" | "user" | "message" | "live_stream" | "advertisement" | "product";
  targetId: Types.ObjectId;
  reason: ReportReason;
  details: string;
  status: "open" | "actioned" | "dismissed";
  resolution: string | null;
  resolvedByUserId: Types.ObjectId | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface IAnalyticsEvent {
  _id: Types.ObjectId;
  type:
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
  userId: Types.ObjectId | null;
  businessId: Types.ObjectId | null;
  postId: Types.ObjectId | null;
  productId: Types.ObjectId | null;
  advertisementId: Types.ObjectId | null;
  valueMs: number;
  country: string | null;
  createdAt: Date;
}

export interface IAuditLog {
  _id: Types.ObjectId;
  actorUserId: Types.ObjectId;
  action: string;
  targetType: string;
  targetId: Types.ObjectId | null;
  detail: Record<string, unknown>;
  createdAt: Date;
}

export interface ISession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  userAgent: string;
  ip: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface IToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  kind: "email_verify" | "password_reset";
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface IPlatformSetting {
  _id: Types.ObjectId;
  key: string;
  value: unknown;
  updatedByUserId: Types.ObjectId | null;
  updatedAt: Date;
}

/* ---------- API view models ---------- */

export interface BusinessSummary {
  id: string;
  username: string;
  name: string;
  logoUrl: string | null;
  verified: boolean;
  category: string;
  city: string | null;
  country: string | null;
}

export interface UserSummary {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

/** The post's author — a personal creator (user) or a business. */
export type PostAuthor =
  | ({ kind: "user" } & UserSummary)
  | ({ kind: "business" } & BusinessSummary);

export interface PostView {
  id: string;
  type: PostType;
  caption: string;
  mediaUrls: string[];
  thumbnailUrl: string | null;
  hashtags: string[];
  /** The author (personal creator or business). */
  author: PostAuthor;
  /** Legacy alias for the business author — null for personal-creator posts. */
  business: BusinessSummary | null;
  counts: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  viewer: { liked: boolean; saved: boolean; following: boolean };
  isSponsored: boolean;
  sponsoredLabel: string | null;
  /** Audio sound attached to the post, if any. */
  sound: { id: string; title: string; artist: string; audioUrl: string; coverUrl: string | null } | null;
  products: { id: string; name: string; priceCents: number; currency: string; imageUrl: string | null }[];
  city: string | null;
  country: string | null;
  createdAt: string;
}

export interface OfferView {
  id: string;
  business: BusinessSummary & { founding: boolean };
  title: string;
  description: string;
  imageUrl: string | null;
  discountLabel: string;
  priceCents: number | null;
  currency: string | null;
  productId: string | null;
  terms: string;
  status: "draft" | "active" | "paused";
  startsAt: string;
  endsAt: string;
  city: string | null;
  country: string | null;
  availability: "draft" | "scheduled" | "active" | "paused" | "expired";
  clicksCount: number;
  createdAt: string;
}

export const SITE = {
  name: "BuyBuy",
  tagline: "Discover businesses. Watch. Connect. Buy.",
  description:
    "The global business network — discover local and worldwide businesses through short videos, photos, products and live streams.",
  supportEmail: "support@buybuy.app",
} as const;

export const LIMITS = {
  pageSize: 12,
  feedPageSize: 8,
  maxCaptionLength: 2200,
  maxCommentLength: 1000,
  maxMessageLength: 4000,
  imageMaxBytes: 10 * 1024 * 1024, // 10MB
  videoMaxBytes: 150 * 1024 * 1024, // 150MB
  docMaxBytes: 10 * 1024 * 1024,
  soundMaxBytes: 20 * 1024 * 1024, // 20MB — music/audio clips for sounds
} as const;

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_VIDEO_MIME = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const ALLOWED_DOC_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;

export const ALLOWED_AUDIO_MIME = [
  "audio/mpeg", // .mp3
  "audio/mp4", // .m4a
  "audio/x-m4a",
  "audio/wav", // .wav
  "audio/x-wav",
  "audio/aac", // .aac
  "audio/ogg", // .ogg
  "audio/webm", // .webm (MediaRecorder default)
] as const;

export const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? 5);

export const CURRENCIES = ["USD", "EUR", "GBP", "RWF", "KES", "NGN", "GHS", "ZAR", "INR", "CNY"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export const REPORT_REASONS = [
  "spam",
  "fraud",
  "illegal_activity",
  "harassment",
  "fake_business",
  "misleading_ad",
  "copyright",
  "inappropriate_content",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "new_follower",
  "like",
  "comment",
  "reply",
  "message",
  "call_incoming",
  "call_missed",
  "live_started",
  "order_update",
  "order_new",
  "payment",
  "ad_status",
  "verification_status",
  "review",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const USER_ROLES = ["customer", "business", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const BUSINESS_MEMBER_ROLES = ["owner", "manager", "editor"] as const;
export type BusinessMemberRole = (typeof BUSINESS_MEMBER_ROLES)[number];

export const VERIFICATION_STATES = [
  "unverified",
  "pending",
  "verified",
  "rejected",
  "suspended",
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const AD_TYPES = ["boost_post", "sponsored_business", "product_promo"] as const;
export type AdType = (typeof AD_TYPES)[number];

/** CPM price in USD cents per 1000 impressions for self-serve ads. */
export const AD_CPM_CENTS = 200;

export const PREMIUM_PLANS = [
  {
    id: "premium_monthly",
    name: "Premium Business — Monthly",
    priceCents: 1900,
    currency: "USD" as CurrencyCode,
    intervalDays: 30,
    features: ["Verified-fast review", "Advanced analytics", "Featured discovery slots", "Ad credits"],
  },
] as const;

export const SESSION_COOKIE = "bb_session";
export const OAUTH_STATE_COOKIE = "bb_oauth_state";
export const SESSION_TTL_DAYS = 30;

/* ---------- Launch & growth (addendum) ---------- */

/** Platform access lifecycle: private → invite_only → early_access → public. */
export const ACCESS_MODES = ["public", "early_access", "invite_only", "private"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export const OFFER_STATUSES = ["draft", "active", "paused"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** Derived from stored status + date window for display/filtering. */
export type OfferAvailability = "draft" | "scheduled" | "active" | "paused" | "expired";

export const REFERRAL_TYPES = ["customer", "business"] as const;
export type ReferralType = (typeof REFERRAL_TYPES)[number];

export const WAITLIST_TYPES = ["customer", "business"] as const;
export type WaitlistType = (typeof WAITLIST_TYPES)[number];

export const WAITLIST_STATUSES = ["pending", "invited", "converted"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export const CLAIM_STATUSES = ["n/a", "unclaimed", "pending", "claimed"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

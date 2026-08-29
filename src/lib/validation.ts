import { z } from "zod";
import {
  CURRENCIES,
  LIMITS,
  REPORT_REASONS,
  NOTIFICATION_TYPES,
} from "@/config/constants";
import { CATEGORY_SLUGS } from "@/config/categories";

const usernameRegex = /^[a-z0-9._]{3,30}$/;
const passwordRegex = /^.{8,128}$/;

export const usernameSchema = z
  .string()
  .regex(usernameRegex, "Username must be 3-30 chars: a-z, 0-9, dot or underscore");

export const emailSchema = z.string().email().max(254).toLowerCase();

export const passwordSchema = z
  .string()
  .regex(passwordRegex, "Password must be at least 8 characters")
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), "Password must contain letters and numbers");

/* ---------- Auth ---------- */

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema.optional(),
  accountType: z.enum(["customer", "business"]).default("customer"),
  country: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional(),
  /** Referral/invite code (addendum #17/#18) — required when the platform is invite-only. */
  referralCode: z.string().trim().max(32).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({ token: z.string().min(10).max(200) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

/* ---------- User settings ---------- */

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(500).optional(),
  country: z.string().trim().max(60).optional().nullable(),
  city: z.string().trim().max(60).optional().nullable(),
  avatarKey: z.string().max(300).optional().nullable(),
  allowCalls: z.boolean().optional(),
  allowMessagesFromAnyone: z.boolean().optional(),
  notifications: z.record(z.enum(NOTIFICATION_TYPES), z.boolean()).optional(),
});

/* ---------- Business ---------- */

export const createBusinessSchema = z.object({
  name: z.string().trim().min(2).max(100),
  username: usernameSchema,
  description: z.string().trim().max(5000).default(""),
  category: z.string().refine((v) => CATEGORY_SLUGS.includes(v), "Unknown category"),
  subcategory: z.string().trim().max(80).default(""),
  country: z.string().trim().max(60).default(""),
  region: z.string().trim().max(60).default(""),
  city: z.string().trim().max(60).default(""),
  address: z.string().trim().max(300).default(""),
  phone: z.string().trim().max(30).default(""),
  email: z.union([emailSchema, z.literal("")]).default(""),
  whatsapp: z.string().trim().max(30).default(""),
  website: z.string().url().max(300).or(z.literal("")).default(""),
  currency: z.enum(CURRENCIES).default("USD"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updateBusinessSchema = createBusinessSchema.partial().extend({
  logoKey: z.string().max(300).nullable().optional(),
  coverKey: z.string().max(300).nullable().optional(),
  socialLinks: z.array(z.object({ platform: z.string().max(30), url: z.string().url().max(300) })).max(8).optional(),
  openingHours: z
    .array(z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/), closed: z.boolean() }))
    .length(7)
    .nullable()
    .optional(),
  allowCalls: z.boolean().optional(),
  allowOrders: z.boolean().optional(),
});

export const businessQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(40).optional(),
  country: z.string().max(60).optional(),
  city: z.string().max(60).optional(),
  sort: z.enum(["relevance", "followers", "rating", "newest"]).default("newest"),
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(LIMITS.pageSize),
});

export const memberAddSchema = z.object({
  email: emailSchema,
  role: z.enum(["manager", "editor"]),
});

export const reviewCreateSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().max(2000).default(""),
});

/* ---------- Posts ---------- */

export const createPostSchema = z.object({
  type: z.enum(["text", "image", "video"]),
  caption: z.string().trim().max(LIMITS.maxCaptionLength).default(""),
  mediaKeys: z.array(z.string().max(300)).max(10).default([]),
  thumbnailKey: z.string().max(300).optional(),
  soundId: z.string().max(64).optional().nullable(),
  hashtags: z.array(z.string().trim().max(50)).max(20).default([]),
  productIds: z.array(z.string().max(64)).max(10).default([]),
  visibility: z.enum(["public", "followers"]).default("public"),
  city: z.string().trim().max(60).optional(),
  country: z.string().trim().max(60).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updatePostSchema = z.object({
  caption: z.string().trim().max(LIMITS.maxCaptionLength).optional(),
  visibility: z.enum(["public", "followers"]).optional(),
  productIds: z.array(z.string().max(64)).max(10).optional(),
});

/* ---------- Sounds (TikTok-style sound library) ---------- */

export const createSoundSchema = z.object({
  title: z.string().trim().min(1).max(140),
  artist: z.string().trim().max(140).default(""),
  audioKey: z.string().min(1).max(300),
  coverKey: z.string().max(300).optional(),
  durationSec: z.coerce.number().int().min(0).max(86_400).default(0),
  businessId: z.string().max(64).optional().nullable(),
  official: z.boolean().optional(),
});

export const soundQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const commentCreateSchema = z.object({
  text: z.string().trim().min(1).max(LIMITS.maxCommentLength),
  parentId: z.string().max(64).optional(),
});

export const feedQuerySchema = z.object({
  tab: z.enum(["for-you", "following", "trending", "nearby", "saved", "reels"]).default("for-you"),
  category: z.string().max(40).optional(),
  businessId: z.string().max(64).optional(),
  cursor: z.string().max(200).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  country: z.string().max(60).optional(),
  city: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(LIMITS.feedPageSize),
});

/* ---------- Products & orders ---------- */

export const productCreateSchema = z.object({
  kind: z.enum(["product", "service"]).default("product"),
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(5000).default(""),
  imageKeys: z.array(z.string().max(300)).max(8).default([]),
  videoKey: z.string().max(300).optional(),
  priceCents: z.coerce.number().int().min(0).max(100_000_000_00),
  currency: z.enum(CURRENCIES),
  stock: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  category: z.string().refine((v) => CATEGORY_SLUGS.includes(v)),
  variants: z.array(z.object({ name: z.string().max(50), options: z.array(z.string().max(50)).max(20) })).max(5).default([]),
  available: z.boolean().default(true),
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  status: z.enum(["active", "hidden"]).optional(),
});

export const orderCreateSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        quantity: z.coerce.number().int().min(1).max(999),
        variantSelection: z.record(z.string().max(50), z.string().max(50)).optional(),
      })
    )
    .min(1)
    .max(50),
  customerContact: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(30).optional(),
    email: emailSchema.optional(),
    address: z.string().trim().max(300).optional(),
    note: z.string().trim().max(500).optional(),
  }),
});

export const orderStatusSchema = z.object({
  status: z.enum(["processing", "shipped", "delivered", "cancelled", "refunded"]),
});

/* ---------- Messaging ---------- */

export const conversationStartSchema = z.object({ businessId: z.string().min(1).max(64) });

export const messageSendSchema = z
  .object({
    text: z.string().trim().max(LIMITS.maxMessageLength).default(""),
    mediaKey: z.string().max(300).optional(),
  })
  .refine((v) => v.text.length > 0 || Boolean(v.mediaKey), { message: "Message must have text or media" });

/* ---------- Calls ---------- */

export const callStartSchema = z.object({
  businessId: z.string().min(1).max(64),
  type: z.enum(["voice", "video"]),
});

export const callSignalSchema = z.object({
  kind: z.enum(["offer", "answer", "candidate"]),
  data: z.unknown(),
});

/* ---------- Live ---------- */

export const liveStartSchema = z.object({
  title: z.string().trim().min(3).max(140),
  embedUrl: z
    .string()
    .url()
    .max(500)
    .refine(
      (u) => /^https:\/\/(www\.)?(youtube\.com|youtu\.be|facebook\.com|twitch\.tv|vimeo\.com|rumble\.com)\//.test(u),
      "Only YouTube, Facebook, Twitch, Vimeo or Rumble live embeds are supported"
    ),
  thumbnailKey: z.string().max(300).optional(),
});

/* ---------- Reports / blocks / ads ---------- */

export const reportCreateSchema = z.object({
  targetType: z.enum(["post", "comment", "business", "user", "message", "live_stream", "advertisement", "product"]),
  targetId: z.string().min(1).max(64),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(2000).default(""),
});

export const blockToggleSchema = z.object({ userId: z.string().min(1).max(64) });

export const adCreateSchema = z.object({
  type: z.enum(["boost_post", "sponsored_business", "product_promo"]),
  postId: z.string().max(64).optional(),
  productId: z.string().max(64).optional(),
  title: z.string().trim().min(3).max(120),
  budgetCents: z.coerce.number().int().min(1000).max(1_000_000_00),
  impressionsGoal: z.coerce.number().int().min(1000).max(100_000_000),
  durationDays: z.coerce.number().int().min(1).max(90),
  targeting: z
    .object({
      countries: z.array(z.string().max(60)).max(20).default([]),
      categories: z.array(z.string().max(40)).max(10).default([]),
    })
    .default({ countries: [], categories: [] }),
});

/* ---------- Verification ---------- */

export const verificationSubmitSchema = z.object({
  registrationNumber: z.string().trim().min(2).max(80),
  note: z.string().trim().max(2000).default(""),
  documents: z
    .array(z.object({ type: z.string().trim().max(50), fileKey: z.string().min(1).max(300), label: z.string().trim().max(100) }))
    .min(1)
    .max(6),
});

export const verificationReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reviewNote: z.string().trim().max(1000).default(""),
});

/* ---------- Analytics ---------- */

export const analyticsEventSchema = z.object({
  type: z.enum([
    "post_view",
    "profile_visit",
    "product_click",
    "contact_click",
    "website_click",
    "whatsapp_click",
    "call_click",
    "message_click",
    "offer_click",
    "share",
  ]),
  postId: z.string().max(64).optional(),
  productId: z.string().max(64).optional(),
  offerId: z.string().max(64).optional(),
  valueMs: z.coerce.number().int().min(0).max(3_600_000).default(0),
});

/* ---------- Admin ---------- */

export const adminUserActionSchema = z.object({
  action: z.enum(["suspend", "ban", "activate", "make_admin", "remove_admin", "grant_founding_customer", "revoke_founding_customer"]),
  reason: z.string().trim().max(500).optional(),
});

export const adminBusinessActionSchema = z.object({
  action: z.enum(["verify", "reject_verification", "suspend", "activate", "grant_founding_business", "revoke_founding_business"]),
  reason: z.string().trim().max(500).optional(),
});

export const adminReportResolveSchema = z.object({
  decision: z.enum(["actioned", "dismissed"]),
  resolution: z.enum(["remove_content", "suspend_account", "warn", "no_action"]),
  note: z.string().trim().max(1000).default(""),
});

export const adminAdActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

export const categoryUpsertSchema = z.object({
  slug: usernameSchema,
  name: z.string().trim().min(2).max(60),
  icon: z.string().trim().max(40).default("store"),
  active: z.boolean().default(true),
  order: z.coerce.number().int().min(0).max(999).default(0),
});

/* ---------- Growth (addendum) ---------- */

export const offerCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(""),
  mediaKeys: z.array(z.string().max(300)).max(5).default([]),
  discountLabel: z.string().trim().min(1).max(60),
  priceCents: z.coerce.number().int().min(0).max(100_000_000_000).nullable().default(null),
  currency: z.enum(CURRENCIES).nullable().default(null),
  productId: z.string().max(64).nullable().default(null),
  terms: z.string().trim().max(1000).default(""),
  startsAt: z.string().min(4).max(40),
  endsAt: z.string().min(4).max(40),
  status: z.enum(["draft", "active", "paused"]).default("active"),
});

export const offerUpdateSchema = offerCreateSchema.partial();

export const waitlistSchema = z.object({
  type: z.enum(["customer", "business"]),
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: z.string().trim().max(30).optional(),
  country: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional(),
  businessName: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
});

export const referralInviteSchema = z.object({
  type: z.enum(["customer", "business"]).default("customer"),
  email: emailSchema.optional(),
});

export const claimBusinessSchema = z.object({
  note: z.string().trim().min(10).max(2000),
  docFileKey: z.string().max(300).optional(),
});

export const adminPlatformConfigSchema = z.object({
  accessMode: z.enum(["public", "early_access", "invite_only", "private"]).optional(),
  launchCountries: z.array(z.string().trim().min(2).max(60)).max(50).optional(),
  launchCities: z.array(z.string().trim().min(2).max(60)).max(100).optional(),
  launchRegions: z.array(z.string().trim().min(2).max(60)).max(100).optional(),
  foundingProgram: z
    .object({
      enabled: z.boolean().optional(),
      businessBadgeText: z.string().trim().min(2).max(40).optional(),
      customerBadgeText: z.string().trim().min(2).max(40).optional(),
      autoGrantBusinessUntil: z.string().datetime().nullable().optional(),
      autoGrantCustomerUntil: z.string().datetime().nullable().optional(),
    })
    .optional(),
  referralEnabled: z.boolean().optional(),
});

export const adminManualBusinessSchema = z.object({
  name: z.string().trim().min(2).max(100),
  username: usernameSchema,
  category: z.string().refine((v) => CATEGORY_SLUGS.includes(v), "Unknown category"),
  description: z.string().trim().max(5000).default(""),
  country: z.string().trim().max(60).default(""),
  region: z.string().trim().max(60).default(""),
  city: z.string().trim().max(60).default(""),
  address: z.string().trim().max(300).default(""),
  phone: z.string().trim().max(30).default(""),
  whatsapp: z.string().trim().max(30).default(""),
  email: z.union([emailSchema, z.literal("")]).default(""),
  website: z.string().trim().max(300).default(""),
  currency: z.enum(CURRENCIES).default("USD"),
  founding: z.boolean().default(false),
});

export const adminClaimResolveSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reviewNote: z.string().trim().max(1000).default(""),
});

export const adminWaitlistActionSchema = z.object({
  action: z.enum(["mark_invited"]),
});

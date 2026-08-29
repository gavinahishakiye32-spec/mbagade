import { Types } from "mongoose";
import { User, Business, BusinessMember, Referral, WaitlistEntry, ClaimRequest } from "@/server/models";
import type { IBusiness, IUser, SafeUser } from "@/types";
import { ApiError } from "@/lib/api";
import { getPlatformConfig } from "@/services/platform-config.service";
import { notify } from "@/services/notification.service";
import type { ReferralType, WaitlistType } from "@/config/constants";

/**
 * Launch-phase growth mechanics (development addendum #7–#10, #17–#20):
 * founding programs, referrals, waitlist, admin-assisted onboarding and
 * business claiming. Everything here works with REAL users only — the system
 * creates distribution and record-keeping, never artificial engagement.
 */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L

export function generateReferralCode(rand: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return code;
}

/* ---------------- Founding programs ---------------- */

/** Auto-grant check at account/business creation time (config-driven window). */
export async function maybeAutoGrantFounding(kind: "customer" | "business", doc: IUser | IBusiness): Promise<void> {
  const config = await getPlatformConfig();
  if (!config.foundingProgram.enabled) return;
  const until =
    kind === "business" ? config.foundingProgram.autoGrantBusinessUntil : config.foundingProgram.autoGrantCustomerUntil;
  if (!until) return;
  if (Date.now() > new Date(until).getTime()) return;

  if (kind === "business") {
    await Business.updateOne(
      { _id: (doc as IBusiness)._id, isFoundingBusiness: false },
      { $set: { isFoundingBusiness: true, foundingBusinessAt: new Date() } }
    );
  } else {
    await User.updateOne(
      { _id: (doc as IUser)._id, isFoundingCustomer: false },
      { $set: { isFoundingCustomer: true, foundingCustomerAt: new Date() } }
    );
  }
}

export async function setFoundingBusiness(businessId: string, grant: boolean): Promise<IBusiness> {
  const business = await Business.findByIdAndUpdate(
    businessId,
    { $set: { isFoundingBusiness: grant, foundingBusinessAt: grant ? new Date() : null } },
    { new: true }
  );
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);
  return business;
}

export async function setFoundingCustomer(userId: string, grant: boolean): Promise<SafeUser> {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { isFoundingCustomer: grant, foundingCustomerAt: grant ? new Date() : null } },
    { new: true }
  );
  if (!user) throw new ApiError("NOT_FOUND", "User not found", 404);
  return user.toObject() as unknown as SafeUser;
}

/* ---------------- Referrals (#17, #18) ---------------- */

export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await User.findById(userId).select("referralCode");
  if (!user) throw new ApiError("NOT_FOUND", "User not found", 404);
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();
    try {
      await User.updateOne({ _id: userId, referralCode: null }, { $set: { referralCode: code } });
      return code;
    } catch {
      /* duplicate code — retry */
    }
  }
  throw new ApiError("INTERNAL_ERROR", "Could not allocate a referral code", 500);
}

export async function listMyReferrals(userId: string) {
  const code = await ensureReferralCode(userId);
  const invites = await Referral.find({ referrerUserId: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return {
    code,
    invites: invites.map((r) => ({
      id: String(r._id),
      type: r.type,
      invitedEmail: r.invitedEmail,
      status: r.status,
      completedAt: r.completedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function createReferralInvite(
  referrer: SafeUser,
  input: { email?: string; type: ReferralType }
): Promise<{ id: string; code: string; inviteUrl: string }> {
  const config = await getPlatformConfig();
  if (!config.referralEnabled) throw new ApiError("FORBIDDEN", "Referrals are currently disabled", 403);

  const code = generateReferralCode();
  const referral = await Referral.create({
    type: input.type,
    referrerUserId: referrer._id,
    code,
    invitedEmail: input.email?.toLowerCase() ?? null,
  });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    id: String(referral._id),
    code,
    inviteUrl: `${base}/register?ref=${code}`,
  };
}

/**
 * Called during registration. Returns the referral (if any) to complete.
 * In invite_only mode a valid pending code is REQUIRED; in private mode
 * self-registration is blocked entirely (checked by the route beforehand).
 */
export async function consumeReferralCode(
  code: string | undefined,
  newUserId: Types.ObjectId
): Promise<void> {
  if (!code) return;
  const referral = await Referral.findOne({ code, status: "pending" });
  if (!referral) throw new ApiError("INVALID_REFERRAL", "This invite code is not valid anymore", 400);

  referral.status = "completed";
  referral.referredUserId = newUserId;
  referral.completedAt = new Date();
  await referral.save();

  await User.updateOne({ _id: newUserId }, { $set: { referredByUserId: referral.referrerUserId } });
}

export async function requireValidReferralForRegistration(code: string | undefined): Promise<void> {
  const config = await getPlatformConfig();
  if (config.accessMode === "invite_only") {
    if (!code) throw new ApiError("INVITE_REQUIRED", "Registration currently requires an invite code", 403);
    const pending = await Referral.exists({ code, status: "pending" });
    if (!pending) throw new ApiError("INVALID_REFERRAL", "This invite code is not valid anymore", 403);
  }
}

/* ---------------- Waitlist (#19) ---------------- */

export async function joinWaitlist(input: {
  type: WaitlistType;
  name: string;
  email: string;
  phone?: string;
  country?: string;
  city?: string;
  businessName?: string;
  category?: string;
}): Promise<{ id: string }> {
  const existing = await WaitlistEntry.findOne({ email: input.email.toLowerCase(), type: input.type }).lean();
  if (existing) return { id: String(existing._id) }; // idempotent join
  const entry = await WaitlistEntry.create({
    type: input.type,
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    country: input.country ?? null,
    city: input.city ?? null,
    businessName: input.businessName ?? null,
    category: input.category ?? null,
  });
  return { id: String(entry._id) };
}

/* ---------------- Admin-assisted onboarding (#9) ---------------- */

export interface ManualBusinessInput {
  name: string;
  username: string;
  category: string;
  description?: string;
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  currency?: string;
  founding?: boolean;
}

/**
 * Creates an unclaimed business profile on behalf of a founder/admin.
 * The real owner later claims it through verification (#10).
 */
export async function adminCreateBusiness(
  adminId: string,
  input: ManualBusinessInput
): Promise<IBusiness> {
  const existing = await Business.findOne({ username: input.username.toLowerCase() }).lean();
  if (existing) throw new ApiError("USERNAME_TAKEN", "A business with this username already exists", 409);

  const business = await Business.create({
    ownerUserId: new Types.ObjectId(adminId), // placeholder until claimed — admins manage everything anyway
    username: input.username.toLowerCase(),
    name: input.name,
    description: input.description ?? "",
    category: input.category,
    country: input.country || null,
    region: input.region || null,
    city: input.city || null,
    address: input.address || null,
    phone: input.phone || null,
    whatsapp: input.whatsapp || null,
    email: input.email || null,
    website: input.website || null,
    currency: input.currency ?? "USD",
    claimStatus: "unclaimed",
    createdByAdmin: true,
    ...(input.founding ? { isFoundingBusiness: true, foundingBusinessAt: new Date() } : {}),
  });
  return business;
}

/* ---------------- Business claiming (#10) ---------------- */

export async function submitClaim(
  user: SafeUser,
  input: { businessId: string; note: string; docFileKey?: string }
): Promise<{ id: string }> {
  const business = await Business.findById(input.businessId).select("claimStatus name").lean();
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);
  if (business.claimStatus !== "unclaimed" && business.claimStatus !== "n/a") {
    throw new ApiError("NOT_CLAIMABLE", "This business profile cannot be claimed right now", 409);
  }

  const already = await ClaimRequest.findOne({
    businessId: input.businessId,
    userId: user._id,
    status: "pending",
  }).lean();
  if (already) throw new ApiError("CLAIM_PENDING", "You already have a pending claim for this business", 409);

  const claim = await ClaimRequest.create({
    businessId: input.businessId,
    userId: user._id,
    note: input.note,
    docFileKey: input.docFileKey ?? null,
  });

  await Business.updateOne(
    { _id: input.businessId, claimStatus: { $in: ["unclaimed", "n/a"] } },
    { $set: { claimStatus: "pending" } }
  );

  await notify({
    userId: user._id,
    type: "system",
    title: "Claim submitted",
    body: `Your claim for ${business.name} is under review.`,
    url: `/b/${input.businessId}`,
  });

  return { id: String(claim._id) };
}

export async function listClaims(status: string | undefined) {
  const filter = status ? { status } : {};
  const claims = await ClaimRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  const [users, businesses] = await Promise.all([
    User.find({ _id: { $in: claims.map((c) => c.userId) } }).select("name email").lean(),
    Business.find({ _id: { $in: claims.map((c) => c.businessId) } }).select("name username city country").lean(),
  ]);
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const bizMap = new Map(businesses.map((b) => [String(b._id), b]));

  return claims.map((c) => {
    const u = userMap.get(String(c.userId));
    const b = bizMap.get(String(c.businessId));
    return {
      id: String(c._id),
      status: c.status,
      note: c.note,
      docFileKey: c.docFileKey,
      createdAt: c.createdAt.toISOString(),
      user: u ? { id: String(u._id), name: u.name, email: u.email } : null,
      business: b
        ? { id: String(b._id), name: b.name, username: b.username, city: b.city, country: b.country }
        : null,
    };
  });
}

export async function resolveClaim(
  adminId: string,
  claimId: string,
  decision: "approved" | "rejected",
  reviewNote: string
): Promise<void> {
  const claim = await ClaimRequest.findById(claimId);
  if (!claim || claim.status !== "pending") throw new ApiError("NOT_FOUND", "Pending claim not found", 404);

  claim.status = decision;
  claim.reviewNote = reviewNote || null;
  claim.reviewedByUserId = new Types.ObjectId(adminId);
  claim.reviewedAt = new Date();
  await claim.save();

  const business = await Business.findById(claim.businessId).select("name username claimStatus");
  if (!business) return;

  if (decision === "approved") {
    // Transfer ownership to the claiming user.
    business.ownerUserId = claim.userId;
    business.claimStatus = "claimed";
    business.createdByAdmin = false;
    await business.save();

    await BusinessMember.updateOne(
      { businessId: business._id, userId: claim.userId },
      { $setOnInsert: { businessId: business._id, userId: claim.userId, role: "owner" } },
      { upsert: true }
    );

    // The admin placeholder must not keep an owner membership if one was created.
    await BusinessMember.deleteMany({ businessId: business._id, userId: adminId, role: "owner" });

    await notify({
      userId: claim.userId,
      type: "system",
      title: "Claim approved",
      body: `You are now the owner of ${business.name}.`,
      url: `/dashboard/${String(business._id)}`,
    });
  } else {
    // Free the profile for other claimants.
    await Business.updateOne({ _id: business._id, claimStatus: "pending" }, { $set: { claimStatus: "unclaimed" } });
    await notify({
      userId: claim.userId,
      type: "system",
      title: "Claim rejected",
      body: reviewNote || `Your claim for ${business.name} was not approved.`,
      url: `/b/${String(business._id)}`,
    });
  }
}

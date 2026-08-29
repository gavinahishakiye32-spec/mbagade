import { Types } from "mongoose";
import { User, Session, Token, BusinessMember, Follow } from "@/server/models";
import type { IUser, SafeUser } from "@/types";
import { hashPassword, verifyPassword, generateToken, hashToken } from "@/lib/password";
import { ApiError } from "@/lib/api";
import { toSafeUser } from "@/lib/auth";
import { slugifyUsername } from "@/lib/utils";
import { verificationEmail, passwordResetEmail } from "@/services/email.service";
import { notify } from "@/services/notification.service";
import { track } from "@/services/analytics.service";
import { env } from "@/lib/env";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  username?: string;
  accountType: "customer" | "business";
  country?: string;
  city?: string;
  referralCode?: string;
}

export async function registerUser(input: RegisterInput): Promise<{ user: SafeUser; verifyUrl: string | null }> {
  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) throw new ApiError("EMAIL_TAKEN", "An account with this email already exists", 409);

  // Username: provided or derived from name/email; ensure uniqueness
  let username = input.username ?? (slugifyUsername(input.name) || `user${Date.now().toString(36)}`);
  {
    let attempt = username;
    let n = 1;
    while (await User.findOne({ username: attempt }).lean()) {
      attempt = `${username}${n}`;
      n++;
      if (n > 50) throw new ApiError("USERNAME_TAKEN", "Could not derive a free username — pick one during signup", 409);
    }
    username = attempt;
  }

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    name: input.name,
    email: input.email,
    username,
    passwordHash,
    role: input.accountType === "business" ? "business" : "customer",
    country: input.country || null,
    city: input.city || null,
  });

  const verifyUrl = await issueEmailVerification(String(user._id), user.email, user.name);
  return { user: toSafeUser(user.toObject() as IUser), verifyUrl };
}

export async function authenticate(email: string, password: string): Promise<SafeUser> {
  const user = await User.findOne({ email }).select("+passwordHash +loginFailures");
  if (!user) throw new ApiError("INVALID_CREDENTIALS", "Incorrect email or password", 401);

  if (user.loginFailures.lockedUntil && user.loginFailures.lockedUntil > new Date()) {
    const mins = Math.ceil((user.loginFailures.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new ApiError("ACCOUNT_LOCKED", `Too many failed attempts. Try again in ${mins} minute(s).`, 429);
  }
  if (user.status === "banned") throw new ApiError("ACCOUNT_BANNED", "This account has been banned", 403);
  if (user.status === "deleted") throw new ApiError("INVALID_CREDENTIALS", "Incorrect email or password", 401);

  const valid = user.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
  if (!valid) {
    const count = user.loginFailures.count + 1;
    const lockedUntil = count >= 10 ? new Date(Date.now() + 15 * 60_000) : null;
    await User.updateOne({ _id: user._id }, { loginFailures: { count: lockedUntil ? 0 : count, lockedUntil } });
    throw new ApiError("INVALID_CREDENTIALS", "Incorrect email or password", 401);
  }

  await User.updateOne({ _id: user._id }, { loginFailures: { count: 0, lockedUntil: null }, lastLoginAt: new Date() });
  return toSafeUser(user.toObject() as IUser);
}

export async function createSession(userId: string, ip: string, userAgent: string): Promise<string> {
  const expiresAt = new Date(Date.now() + 30 * 86_400_000);
  const session = await Session.create({ userId: new Types.ObjectId(userId), ip, userAgent, expiresAt });
  return String(session._id);
}

export async function revokeSession(sessionId: string, userId: string): Promise<void> {
  await Session.updateOne({ _id: sessionId, userId }, { revokedAt: new Date() });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await Session.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

export async function listSessions(userId: string) {
  const sessions = await Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .limit(20)
    .lean();
  return sessions.map((s) => ({
    id: String(s._id),
    userAgent: s.userAgent,
    ip: s.ip,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
  }));
}

/* ---------- Email verification & password reset ---------- */

async function issueEmailVerification(userId: string, email: string, name: string): Promise<string | null> {
  const token = generateToken(24);
  await Token.create({
    userId: new Types.ObjectId(userId),
    kind: "email_verify",
    tokenHash: await hashToken(token),
    expiresAt: new Date(Date.now() + 24 * 3_600_000),
  });
  const url = `${env.appUrl}/verify-email?token=${token}`;
  try {
    await verificationEmail(email, name, url);
    return url;
  } catch {
    return null;
  }
}

export async function verifyEmail(token: string): Promise<boolean> {
  const record = await Token.findOne({ kind: "email_verify", tokenHash: await hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } });
  if (!record) return false;
  record.usedAt = new Date();
  await record.save();
  await User.updateOne({ _id: record.userId }, { emailVerifiedAt: new Date() });
  return true;
}

export async function requestPasswordReset(email: string): Promise<string | null> {
  const user = await User.findOne({ email }).lean();
  if (!user) return null; // do not reveal account existence
  const token = generateToken(24);
  await Token.create({
    userId: user._id,
    kind: "password_reset",
    tokenHash: await hashToken(token),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  const url = `${env.appUrl}/reset-password?token=${token}`;
  await passwordResetEmail(user.email, user.name, url).catch(() => undefined);
  return url;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const record = await Token.findOne({ kind: "password_reset", tokenHash: await hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } });
  if (!record) return false;
  record.usedAt = new Date();
  await record.save();
  const passwordHash = await hashPassword(newPassword);
  await User.updateOne({ _id: record.userId }, { passwordHash });
  await revokeAllSessions(String(record.userId));
  return true;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user || !user.passwordHash) throw new ApiError("INVALID_INPUT", "Password change unavailable for this account", 422);
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new ApiError("INVALID_CREDENTIALS", "Current password is incorrect", 401);
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
}

/* ---------- OAuth ---------- */

export interface OAuthProfile {
  provider: "google" | "facebook";
  providerAccountId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export async function findOrCreateOAuthUser(profile: OAuthProfile): Promise<SafeUser> {
  let user: IUser | null = await User.findOne({
    oauthAccounts: { $elemMatch: { provider: profile.provider, providerAccountId: profile.providerAccountId } },
  }).lean<IUser | null>();

  if (!user && profile.email) {
    user = await User.findOne({ email: profile.email.toLowerCase() }).lean<IUser | null>();
    if (user) {
      await User.updateOne(
        { _id: user._id },
        {
          $push: {
            oauthAccounts: {
              provider: profile.provider,
              providerAccountId: profile.providerAccountId,
              email: profile.email,
              linkedAt: new Date(),
            },
          },
          ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
        }
      );
    }
  }

  if (!user) {
    const base = slugifyUsername(profile.name ?? profile.email?.split("@")[0] ?? "user") || "user";
    let username = base;
    let n = 1;
    while (await User.findOne({ username })) {
      username = `${base}${n}`;
      n++;
    }
    const created = await User.create({
      name: profile.name ?? "New user",
      email: profile.email ?? `${profile.provider}_${profile.providerAccountId}@users.buybuy.local`,
      username,
      emailVerifiedAt: profile.email ? new Date() : null,
      oauthAccounts: [
        {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          email: profile.email ?? undefined,
          linkedAt: new Date(),
        },
      ],
    });
    user = created.toObject() as IUser;
  }

  return toSafeUser(user as IUser);
}

/* ---------- Account deletion ---------- */

export async function deleteAccount(userId: string): Promise<void> {
  await BusinessMember.deleteMany({ userId });
  await revokeAllSessions(userId);
  await User.updateOne(
    { _id: userId },
    {
      status: "deleted",
      name: "Deleted user",
      bio: "",
      avatarKey: null,
      passwordHash: null,
      oauthAccounts: [],
      email: `deleted_${userId}@users.buybuy.local`,
    }
  );
}

/* ---------- Personal creators: follow / public profile ---------- */

export async function getPublicUser(username: string): Promise<IUser | null> {
  return User.findOne({ username: username.toLowerCase(), status: { $ne: "deleted" } }).lean<IUser | null>();
}

export async function getPublicUserById(id: string): Promise<IUser | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return User.findOne({ _id: id, status: { $ne: "deleted" } }).lean<IUser | null>();
}

export async function toggleFollowUser(userId: string, targetUserId: string): Promise<{ following: boolean; followersCount: number }> {
  if (String(userId) === String(targetUserId)) throw new ApiError("INVALID_INPUT", "You cannot follow yourself", 422);

  const target = await User.findOne({ _id: targetUserId, status: { $in: ["active", "suspended"] } }).select("_id status");
  if (!target) throw new ApiError("NOT_FOUND", "User not found", 404);

  const existing = await Follow.findOne({ userId, followedUserId: targetUserId, followingType: "user" });
  if (existing) {
    await existing.deleteOne();
    const updated = await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } }, { new: true }).select("followersCount");
    return { following: false, followersCount: updated?.followersCount ?? 0 };
  }

  await Follow.create({ userId, businessId: null, followedUserId: targetUserId, followingType: "user" });
  const updated = await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: 1 } }, { new: true }).select("followersCount");

  void track({ type: "follow", userId, businessId: null });
  // attribute follow to recent posts by this creator (viral signal)
  const { Post } = await import("@/server/models");
  await Post.updateMany(
    { authorType: "user", authorUserId: targetUserId, createdAt: { $gte: new Date(Date.now() - 7 * 86_400_000) } },
    { $inc: { followsGenerated: 1 } }
  );

  if (String(targetUserId) !== userId) {
    await notify({
      userId: targetUserId,
      type: "new_follower",
      title: "New follower",
      body: `Someone started following you`,
      url: `/u/${(await User.findById(targetUserId).select("username"))?.username}`,
      actorUserId: userId,
    });
  }
  return { following: true, followersCount: updated?.followersCount ?? 0 };
}

export async function isFollowingUser(userId: string | null, targetUserId: string): Promise<boolean> {
  if (!userId) return false;
  return Boolean(await Follow.exists({ userId, followedUserId: targetUserId, followingType: "user" }));
}

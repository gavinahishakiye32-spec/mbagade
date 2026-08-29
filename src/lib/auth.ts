import { cache } from "react";
import type { ISession, IUser, SafeUser } from "@/types";
import { readSessionToken, verifySessionToken } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Session, User } from "@/server/models";

export function toSafeUser(user: IUser): SafeUser {
  const safe = { ...user } as Record<string, unknown>;
  delete safe.passwordHash;
  delete safe.loginFailures;
  return JSON.parse(JSON.stringify(safe)) as SafeUser;
}

/**
 * Resolves the authenticated user for the current request.
 * Cached per-request via React cache. Verifies JWT signature AND
 * checks the session record in the database (revocation support).
 */
export const getAuthUser = cache(async (): Promise<SafeUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;

  await connectDB();
  const session = await Session.findById(claims.sid).lean<ISession | null>();
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  const user = await User.findById(claims.uid).lean<IUser | null>();
  if (!user || user.status === "banned" || user.status === "deleted") return null;

  void Session.updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date() } }).exec();

  return toSafeUser(user as IUser);
});

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<SafeUser> {
  const user = await getAuthUser();
  if (!user) throw new AuthError("UNAUTHENTICATED", "Authentication required");
  if (user.status === "suspended") throw new AuthError("ACCOUNT_SUSPENDED", "Your account is suspended");
  return user;
}

export async function requireAdmin(): Promise<SafeUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AuthError("FORBIDDEN", "Administrator access required");
  return user;
}

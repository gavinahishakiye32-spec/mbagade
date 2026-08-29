import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/config/constants";

export interface SessionClaims {
  sid: string;
  uid: string;
}

function secretKey(): Uint8Array {
  if (!env.authSecret) throw new Error("AUTH_SECRET is required in production");
  return new TextEncoder().encode(env.authSecret);
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ sid: claims.sid, uid: claims.uid })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sid !== "string" || typeof payload.uid !== "string") return null;
    return { sid: payload.sid, uid: payload.uid };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env, oauthConfigured } from "@/lib/env";
import { OAUTH_STATE_COOKIE } from "@/config/constants";
import { findOrCreateOAuthUser, createSession } from "@/services/user.service";
import { signSessionToken, setSessionCookie } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";

/**
 * OAuth 2.0 authorization-code flow — step 2: provider callback.
 * Validates the state cookie (CSRF protection), exchanges the code for tokens
 * using the official token endpoint, fetches the profile, then creates or
 * links the platform account and starts a session.
 */

interface OAuthProfile {
  provider: "google" | "facebook";
  providerAccountId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

async function exchangeGoogle(code: string): Promise<OAuthProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId!,
      client_secret: env.googleClientSecret!,
      redirect_uri: `${env.appUrl}/api/auth/oauth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new Error(`google token exchange failed: ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("google token exchange returned no access_token");

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) throw new Error("google userinfo failed");
  const info = (await infoRes.json()) as { sub: string; email?: string; name?: string; picture?: string; email_verified?: boolean };
  return {
    provider: "google",
    providerAccountId: info.sub,
    email: info.email_verified ? info.email ?? null : info.email ?? null,
    name: info.name ?? null,
    avatarUrl: info.picture ?? null,
  };
}

async function exchangeFacebook(code: string): Promise<OAuthProfile> {
  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("client_id", env.facebookClientId!);
  tokenUrl.searchParams.set("client_secret", env.facebookClientSecret!);
  tokenUrl.searchParams.set("redirect_uri", `${env.appUrl}/api/auth/oauth/facebook/callback`);
  const tokenRes = await fetch(tokenUrl);
  if (!tokenRes.ok) throw new Error(`facebook token exchange failed: ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("facebook token exchange returned no access_token");

  const infoRes = await fetch(
    `https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(access_token)}`
  );
  if (!infoRes.ok) throw new Error("facebook profile fetch failed");
  const info = (await infoRes.json()) as { id: string; name?: string; email?: string; picture?: { data?: { url?: string } } };
  return {
    provider: "facebook",
    providerAccountId: info.id,
    email: info.email ?? null,
    name: info.name ?? null,
    avatarUrl: info.picture?.data?.url ?? null,
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, req.url));

  if (provider !== "google" && provider !== "facebook") return fail("unknown_provider");
  if (!oauthConfigured(provider)) return fail(`${provider}_not_configured`);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("oauth_missing_params");

  const store = await cookies();
  const cookieState = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);
  if (cookieState !== `${provider}:${state}`) return fail("oauth_state_mismatch");

  try {
    const profile = provider === "google" ? await exchangeGoogle(code) : await exchangeFacebook(code);
    await connectDB();
    const user = await findOrCreateOAuthUser(profile);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
    const sid = await createSession(String(user._id), ip, req.headers.get("user-agent") ?? "");
    const token = await signSessionToken({ sid, uid: String(user._id) });
    await setSessionCookie(token);
    return NextResponse.redirect(new URL("/", req.url));
  } catch (err) {
    console.error("[oauth]", err);
    return fail("oauth_failed");
  }
}

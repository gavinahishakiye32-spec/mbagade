import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateToken } from "@/lib/password";
import { env, oauthConfigured } from "@/lib/env";
import { OAUTH_STATE_COOKIE } from "@/config/constants";

/**
 * OAuth 2.0 authorization-code flow — step 1: redirect to the provider.
 * Providers: google | facebook (official OAuth endpoints only).
 *
 * Google setup (console.cloud.google.com → APIs & Services → Credentials):
 *   create an OAuth client ID (Web application) with redirect URI
 *   {APP_URL}/api/auth/oauth/google/callback — scopes: openid email profile.
 *
 * Facebook setup (developers.facebook.com → App → Facebook Login):
 *   add product "Facebook Login", Valid OAuth Redirect URI
 *   {APP_URL}/api/auth/oauth/facebook/callback — scopes: email, public_profile.
 */

const PROVIDERS = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email profile",
    clientId: () => env.googleClientId,
  },
  facebook: {
    authorizeUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    scope: "email,public_profile",
    clientId: () => env.facebookClientId,
  },
} as const;

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!(provider in PROVIDERS)) {
    return NextResponse.redirect(new URL("/login?error=unknown_provider", req.url));
  }
  if (!oauthConfigured(provider as "google" | "facebook")) {
    return NextResponse.redirect(new URL(`/login?error=${provider}_not_configured`, req.url));
  }

  const conf = PROVIDERS[provider as keyof typeof PROVIDERS];
  const state = generateToken(16);
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, `${provider}:${state}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: 600,
  });

  const url = new URL(conf.authorizeUrl);
  url.searchParams.set("client_id", conf.clientId()!);
  url.searchParams.set("redirect_uri", `${env.appUrl}/api/auth/oauth/${provider}/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", conf.scope);
  url.searchParams.set("state", state);
  if (provider === "google") {
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
  }

  return NextResponse.redirect(url.toString());
}

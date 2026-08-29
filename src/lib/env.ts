/** Central environment access. Never import process.env directly elsewhere. */

function str(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  mongoUri: str("MONGODB_URI") ?? "mongodb://127.0.0.1:27017/buybuy",
  authSecret:
    str("AUTH_SECRET") ??
    (process.env.NODE_ENV !== "production" ? "dev-only-insecure-secret-change-me" : undefined),
  appUrl: str("APP_URL") ?? "http://localhost:3000",

  googleClientId: str("GOOGLE_CLIENT_ID"),
  googleClientSecret: str("GOOGLE_CLIENT_SECRET"),
  facebookClientId: str("FACEBOOK_CLIENT_ID"),
  facebookClientSecret: str("FACEBOOK_CLIENT_SECRET"),

  paymentProvider: (str("PAYMENT_PROVIDER") ?? "auto") as "auto" | "stripe" | "dev",
  stripeSecretKey: str("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: str("STRIPE_WEBHOOK_SECRET"),

  smtpHost: str("SMTP_HOST"),
  smtpPort: Number(str("SMTP_PORT") ?? 587),
  smtpUser: str("SMTP_USER"),
  smtpPass: str("SMTP_PASS"),
  smtpFrom: str("SMTP_FROM") ?? "BuyBuy <no-reply@buybuy.app>",

  aiApiKey: str("AI_API_KEY"),
  aiBaseUrl: str("AI_BASE_URL") ?? "https://api.openai.com/v1",
  aiModel: str("AI_MODEL") ?? "gpt-4o-mini",
  aiModerationModel: str("AI_MODERATION_MODEL") ?? str("AI_MODEL") ?? "gpt-4o-mini",

  turnstileSecret: str("TURNSTILE_SECRET"),

  storageDriver: (str("MEDIA_STORAGE_DRIVER") ?? "local") as "local" | "s3",
  s3Endpoint: str("S3_ENDPOINT"),
  s3Region: str("S3_REGION") ?? "us-east-1",
  s3Bucket: str("S3_BUCKET"),
  s3AccessKeyId: str("S3_ACCESS_KEY_ID"),
  s3SecretAccessKey: str("S3_SECRET_ACCESS_KEY"),
  s3PublicBaseUrl: str("S3_PUBLIC_BASE_URL"),

  turnUrls: str("TURN_URLS"),
  turnUsername: str("TURN_USERNAME"),
  turnCredential: str("TURN_CREDENTIAL"),

  /** Initial platform access mode — overridable at runtime via admin platform config. */
  accessMode: str("ACCESS_MODE"),
};

export function oauthConfigured(provider: "google" | "facebook"): boolean {
  if (provider === "google") return Boolean(env.googleClientId && env.googleClientSecret);
  return Boolean(env.facebookClientId && env.facebookClientSecret);
}

export function paymentsConfigured(): boolean {
  return env.paymentProvider === "stripe" ? Boolean(env.stripeSecretKey) : true;
}

export function activePaymentProvider(): "stripe" | "dev" {
  if (env.paymentProvider === "stripe" && env.stripeSecretKey) return "stripe";
  if (env.paymentProvider === "stripe") throw new Error("PAYMENT_PROVIDER=stripe but STRIPE_SECRET_KEY missing");
  if (env.paymentProvider === "dev") return "dev";
  return env.stripeSecretKey ? "stripe" : "dev";
}

export function aiConfigured(): boolean {
  return Boolean(env.aiApiKey);
}

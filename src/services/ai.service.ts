import { env, aiConfigured } from "@/lib/env";

/**
 * AI service — OpenAI-compatible chat completions adapter.
 *
 * Works with any provider exposing the /chat/completions API:
 *   OpenAI (default), Azure OpenAI gateways, Groq, OpenRouter, Together, local vLLM…
 * Configure with AI_API_KEY + optional AI_BASE_URL and AI_MODEL.
 *
 * When no key is configured the service degrades gracefully:
 *  - moderation falls back to a keyword filter (see moderation.service.ts)
 *  - generation endpoints surface AI_NOT_CONFIGURED so the UI can hide/annotate them.
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured. Set AI_API_KEY to enable AI features.");
  }
}

async function chat(messages: ChatMessage[], opts?: { json?: boolean; model?: string; maxTokens?: number }): Promise<string> {
  if (!aiConfigured()) throw new AiNotConfiguredError();
  const res = await fetch(`${env.aiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.aiApiKey}`,
    },
    body: JSON.stringify({
      model: opts?.model ?? env.aiModel,
      messages,
      max_tokens: opts?.maxTokens ?? 500,
      temperature: 0.7,
      ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI provider error (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

/* ---------- Content moderation ---------- */

export interface ModerationVerdict {
  flagged: boolean;
  reasons: string[];
  source: "ai" | "keyword";
}

const MODERATION_SYSTEM = `You are a content moderator for BuyBuy, a global business-only social platform.
Businesses publish product/promo/service content. Flag posts that are:
- not related to any business activity (random personal spam, unrelated entertainment)
- illegal products/services (drugs, weapons, counterfeit, wildlife, human trafficking)
- fraudulent or scam advertisements
- harassment or hate speech
- sexually explicit content
Respond in JSON: {"flagged": boolean, "reasons": string[]} where reasons are short codes like "not_business_content", "illegal", "fraud", "harassment", "explicit".`;

export async function aiModerateText(text: string): Promise<ModerationVerdict> {
  if (!aiConfigured()) return { flagged: false, reasons: [], source: "keyword" };
  try {
    const raw = await chat(
      [
        { role: "system", content: MODERATION_SYSTEM },
        { role: "user", content: text.slice(0, 4000) || "(no text)" },
      ],
      { json: true, model: env.aiModerationModel, maxTokens: 120 }
    );
    const parsed = JSON.parse(raw) as { flagged?: boolean; reasons?: string[] };
    return {
      flagged: Boolean(parsed.flagged),
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 5) : [],
      source: "ai",
    };
  } catch (err) {
    console.error("[ai] moderation failed, allowing content", err);
    return { flagged: false, reasons: [], source: "ai" };
  }
}

/* ---------- Generation helpers ---------- */

export interface BusinessBrief {
  name: string;
  category: string;
  city?: string | null;
  country?: string | null;
  description?: string;
}

export async function aiGenerateBusinessDescription(brief: BusinessBrief): Promise<string> {
  const raw = await chat([
    {
      role: "system",
      content:
        "You write concise, professional business descriptions for an online business directory/social platform. 2-3 sentences, no emojis, no hashtags.",
    },
    {
      role: "user",
      content: `Write a description for this business:\nName: ${brief.name}\nCategory: ${brief.category}\nLocation: ${[brief.city, brief.country].filter(Boolean).join(", ") || "unspecified"}\nExisting notes: ${brief.description || "none"}`,
    },
  ]);
  return raw.trim();
}

export async function aiGeneratePostCaption(brief: BusinessBrief, topic: string): Promise<string> {
  const raw = await chat([
    {
      role: "system",
      content:
        "You write engaging social media captions for businesses on BuyBuy, a business discovery platform. Max 200 characters. May include up to 3 relevant hashtags.",
    },
    {
      role: "user",
      content: `Business: ${brief.name} (${brief.category})\nPost about: ${topic}`,
    },
  ]);
  return raw.trim();
}

export async function aiAnswerBusinessQuestion(question: string, context: string): Promise<string> {
  const raw = await chat([
    {
      role: "system",
      content:
        "You are the AI assistant for business owners on the BuyBuy platform. Answer practical questions about growing a business online, using the provided context about the user's business when relevant. Be concise.",
    },
    { role: "user", content: `My business context: ${context}\n\nQuestion: ${question}` },
  ]);
  return raw.trim();
}

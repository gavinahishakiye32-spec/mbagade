import { aiModerateText } from "@/services/ai.service";
import type { ModerationVerdict } from "@/services/ai.service";

/**
 * Content moderation pipeline.
 * 1. Fast local keyword filter (always on — catches obvious violations cheaply).
 * 2. AI moderation when configured (AI_API_KEY). AI failure = allow (keyword layer still applied).
 * Flagged posts go to "under_review" and are hidden from feeds until an admin approves.
 */

const BLOCKLIST: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(cocaine|heroin|meth(?:amphetamine)?|mdma)\b/i, reason: "illegal" },
  { pattern: /\b(weapon|gun|pistol|rifle|ammo)\s*(for sale|dealer)?\b/i, reason: "illegal" },
  { pattern: /\b(counterfeit|replica)\s+(goods|bags|shoes|watches)\b/i, reason: "counterfeit" },
  { pattern: /\b(ponzi|pyramid\s+scheme|guaranteed\s+profit|double\s+your\s+money)\b/i, reason: "fraud" },
  { pattern: /\bporn|xxx|onlyfans\b/i, reason: "explicit" },
  { pattern: /\bkill\s+(yourself|them)\b|\bkys\b/i, reason: "harassment" },
];

export async function moderateContent(text: string): Promise<ModerationVerdict> {
  const reasons = new Set<string>();
  for (const rule of BLOCKLIST) {
    if (rule.pattern.test(text)) reasons.add(rule.reason);
  }

  const aiVerdict = await aiModerateText(text);
  if (aiVerdict.source === "ai") {
    for (const r of aiVerdict.reasons) reasons.add(r);
    return { flagged: reasons.size > 0, reasons: [...reasons], source: "ai" };
  }

  return { flagged: reasons.size > 0, reasons: [...reasons], source: "keyword" };
}

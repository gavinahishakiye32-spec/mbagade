import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { aiGenerateBusinessDescription } from "@/services/ai.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  city: z.string().max(60).optional(),
  country: z.string().max(60).optional(),
});

/** POST /api/ai/business-description — generate an about text for a new business. */
export const POST = handle(async (req: Request) => {
  await connectDB();
  await requireUser();
  const input = await parseJson(req, schema);
  const description = await aiGenerateBusinessDescription({
    name: input.name,
    category: input.category,
    city: input.city,
    country: input.country,
  });
  return ok({ description });
});

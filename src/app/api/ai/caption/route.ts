import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { aiGeneratePostCaption } from "@/services/ai.service";
import { Business, BusinessMember } from "@/server/models";
import { ApiError } from "@/lib/api";
import type { IBusiness } from "@/types";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

const schema = z.object({
  businessId: z.string().regex(/^[a-f0-9]{24}$/i),
  topic: z.string().max(300).default(""),
});

/** POST /api/ai/caption — generate a post caption for a managed business. */
export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const input = await parseJson(req, schema);

  const member = await BusinessMember.findOne({ userId: user._id, businessId: input.businessId }).lean();
  if (!member) throw new ApiError("FORBIDDEN", "You do not manage this business", 403);

  const business = await Business.findById(input.businessId).lean<IBusiness | null>();
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);

  const caption = await aiGeneratePostCaption(
    {
      name: business.name,
      category: business.category,
      city: business.city ?? undefined,
      country: business.country ?? undefined,
      description: business.description ?? undefined,
    },
    input.topic || "a fresh update about our products and story"
  );
  return ok({ caption });
});

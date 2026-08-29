import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { claimBusinessSchema } from "@/lib/validation";
import { submitClaim } from "@/services/growth.service";
import { connectDB } from "@/lib/mongodb";

/** Submit a claim for an admin-created (unclaimed) business profile (addendum #10). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await ctx.params;
  const user = await requireUser();
  const input = await parseJson(req, claimBusinessSchema);
  const result = await submitClaim(user, { businessId: id, note: input.note, docFileKey: input.docFileKey });
  return ok(result, { status: 201 });
});

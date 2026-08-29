import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { memberAddSchema } from "@/lib/validation";
import { addMember, listMembers } from "@/services/business.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  await requireUser();
  const { id } = await ctx.params;
  return ok({ items: await listMembers(id) });
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = await parseJson(req, memberAddSchema);
  await addMember(user, id, input.email, input.role);
  return ok({ added: true });
});

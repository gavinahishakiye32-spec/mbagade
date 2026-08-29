import { handle, ok, parseJson } from "@/lib/api";
import { z } from "zod";
import { heartbeat } from "@/services/live.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await ctx.params;
  const input = await parseJson(req, z.object({ join: z.boolean() }));
  const viewers = await heartbeat(id, input.join);
  return ok({ viewers });
});

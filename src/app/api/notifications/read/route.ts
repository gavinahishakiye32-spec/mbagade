import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { Notification } from "@/server/models";
import { connectDB } from "@/lib/mongodb";

export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const input = await parseJson(
    req,
    z.object({ ids: z.array(z.string().max(64)).max(100).optional(), all: z.boolean().optional() })
  );

  if (input.all) {
    await Notification.updateMany({ userId: user._id, readAt: null }, { readAt: new Date() });
  } else if (input.ids && input.ids.length > 0) {
    await Notification.updateMany({ userId: user._id, _id: { $in: input.ids }, readAt: null }, { readAt: new Date() });
  }
  return ok({ read: true });
});

import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { blockToggleSchema } from "@/lib/validation";
import { toggleBlock } from "@/services/business.service";
import { Block, User } from "@/server/models";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await connectDB();
  const user = await requireUser();
  const blocks = await Block.find({ blockerId: user._id }).lean();
  const users = await User.find({ _id: { $in: blocks.map((b) => b.blockedId) } }).select("name username").lean();
  return ok({
    items: users.map((u) => ({ id: String(u._id), name: u.name, username: u.username })),
  });
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const input = await parseJson(req, blockToggleSchema);
  return ok(await toggleBlock(String(user._id), input.userId));
});

import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { conversationStartSchema } from "@/lib/validation";
import { getOrCreateConversation, listConversations, unreadCounts } from "@/services/message.service";
import { BusinessMember } from "@/server/models";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const url = new URL(req.url);
  const memberships = await BusinessMember.find({ userId: user._id }).select("businessId").lean();

  const viewer = {
    id: String(user._id),
    role: user.role,
    managedBusinessIds: memberships.map((m) => String(m.businessId)),
  };
  const [items, counts] = await Promise.all([
    listConversations(viewer, {
      archived: url.searchParams.get("archived") === "1",
      q: url.searchParams.get("q") ?? undefined,
    }),
    unreadCounts(viewer),
  ]);
  return ok({ items, unread: counts });
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const { businessId } = await parseJson(req, conversationStartSchema);
  const { conversation, created } = await getOrCreateConversation(String(user._id), businessId);
  return ok({ id: String(conversation._id), created });
});

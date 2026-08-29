import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { Notification } from "@/server/models";
import { toNotificationView } from "@/services/notification.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const cursor = url.searchParams.get("cursor");

  const filter: Record<string, unknown> = { userId: user._id };
  if (unreadOnly) filter.readAt = null;
  if (cursor) filter.createdAt = { $lt: new Date(cursor) };

  const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(21).lean();
  const hasMore = items.length > 20;
  const page = items.slice(0, 20);

  return ok({
    items: page.map(toNotificationView),
    nextCursor: hasMore && page.length > 0 ? page[page.length - 1].createdAt.toISOString() : null,
    unreadCount: await Notification.countDocuments({ userId: user._id, readAt: null }),
  });
});

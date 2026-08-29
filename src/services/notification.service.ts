import { Notification } from "@/server/models";
import type { INotification } from "@/types";
import type { NotificationType } from "@/config/constants";
import type { Types } from "mongoose";

type NotifType = NotificationType;

export interface CreateNotificationInput {
  userId: Types.ObjectId | string;
  type: NotifType;
  title: string;
  body?: string;
  url?: string | null;
  actorUserId?: Types.ObjectId | string | null;
  businessId?: Types.ObjectId | string | null;
  postId?: Types.ObjectId | string | null;
  entityId?: Types.ObjectId | string | null;
}

/**
 * Creates a notification unless the recipient disabled that notification type.
 * Delivery is in-app (polled by the client); an email/webhook channel can be
 * added here later without touching call sites.
 */
export async function notify(input: CreateNotificationInput): Promise<void> {
  const { User } = await import("@/server/models");
  const user = await User.findById(input.userId).select("settings.status").lean<{ settings?: { notifications?: Record<string, boolean> }; status?: string } | null>();
  if (!user || user.status === "banned" || user.status === "deleted") return;

  const prefs = user.settings?.notifications;
  if (prefs && prefs[input.type] === false) return;

  await Notification.create({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? "",
    url: input.url ?? null,
    actorUserId: input.actorUserId ?? null,
    businessId: input.businessId ?? null,
    postId: input.postId ?? null,
    entityId: input.entityId ?? null,
  });
}

export async function notifyMany(userIds: (Types.ObjectId | string)[], input: Omit<CreateNotificationInput, "userId">): Promise<void> {
  if (userIds.length === 0) return;
  await Promise.allSettled(userIds.map((id) => notify({ ...input, userId: id })));
}

export interface NotificationView {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  createdAt: string;
}

export function toNotificationView(n: INotification): NotificationView {
  return {
    id: String(n._id),
    type: n.type as NotifType,
    title: n.title,
    body: n.body,
    url: n.url,
    read: Boolean(n.readAt),
    createdAt: n.createdAt.toISOString(),
  };
}

import { Types } from "mongoose";
import { Conversation, Message, Business, BusinessMember, Block } from "@/server/models";
import type { IConversation, IMessage } from "@/types";
import { ApiError } from "@/lib/api";
import { notify } from "@/services/notification.service";

export interface ConversationView {
  id: string;
  business: { id: string; name: string; username: string; logoUrl: string | null; verified: boolean };
  user: { id: string; name: string; username: string; avatarUrl: string | null };
  lastMessage: { text: string; senderType: "user" | "business"; at: string } | null;
  unread: number;
  updatedAt: string;
}

function conversationView(c: IConversation, business: { _id: Types.ObjectId; name: string; username: string; logoKey: string | null; verification: string }, user: { _id: Types.ObjectId; name: string; username: string; avatarKey: string | null }, perspective: "user" | "business"): ConversationView {
  const media = (k: string | null) => (k ? `/api/media/${k}` : null);
  return {
    id: String(c._id),
    business: {
      id: String(business._id),
      name: business.name,
      username: business.username,
      logoUrl: media(business.logoKey),
      verified: business.verification === "verified",
    },
    user: {
      id: String(user._id),
      name: user.name,
      username: user.username,
      avatarUrl: media(user.avatarKey),
    },
    lastMessage: c.lastMessage ? { text: c.lastMessage.text, senderType: c.lastMessage.senderType as "user" | "business", at: c.lastMessage.at.toISOString() } : null,
    unread: perspective === "user" ? c.unreadForUser : c.unreadForBusiness,
    updatedAt: (c.lastMessageAt ?? c.createdAt).toISOString(),
  };
}

export async function getOrCreateConversation(userId: string, businessId: string): Promise<{ conversation: IConversation; created: boolean }> {
  const business = await Business.findOne({ _id: businessId, status: "active" }).lean();
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);

  if (String(business.ownerUserId) === userId) throw new ApiError("INVALID_INPUT", "You cannot message your own business", 422);

  const blocked = await Block.exists({
    $or: [
      { blockerId: business.ownerUserId, blockedId: userId },
      { blockerId: userId, blockedId: business.ownerUserId },
    ],
  });
  if (blocked) throw new ApiError("BLOCKED", "Messaging is unavailable between these accounts", 403);

  const existing = await Conversation.findOne({ userSideId: userId, businessId }).lean<IConversation | null>();
  if (existing) return { conversation: existing, created: false };

  try {
    const conv = await Conversation.create({ userSideId: new Types.ObjectId(userId), businessId: new Types.ObjectId(businessId) });
    return { conversation: conv.toObject() as IConversation, created: true };
  } catch (err) {
    // unique index race → fetch existing
    const conv = await Conversation.findOne({ userSideId: userId, businessId }).lean<IConversation | null>();
    if (!conv) throw err;
    return { conversation: conv, created: false };
  }
}

export async function listConversations(
  viewer: { id: string; role: string; managedBusinessIds: string[] },
  opts: { archived?: boolean; q?: string }
): Promise<ConversationView[]> {
  const isBusinessSide = viewer.managedBusinessIds.length > 0 && viewer.role !== "customer";
  const filter: Record<string, unknown> = isBusinessSide
    ? { businessId: { $in: viewer.managedBusinessIds }, archivedByBusiness: Boolean(opts.archived) }
    : { userSideId: viewer.id, archivedByUser: Boolean(opts.archived) };

  const convs = (await Conversation.find(filter)
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .populate("businessId", "name username logoKey verification")
    .populate("userSideId", "name username avatarKey")
    .lean()) as unknown as {
    _id: Types.ObjectId;
    userSideId: { _id: Types.ObjectId; name: string; username: string; avatarKey: string | null };
    businessId: { _id: Types.ObjectId; name: string; username: string; logoKey: string | null; verification: string };
    lastMessage: { text: string; senderType: string; at: Date } | null;
    unreadForUser: number;
    unreadForBusiness: number;
    lastMessageAt: Date;
    createdAt: Date;
  }[];

  let items = convs.map((c) =>
    conversationView(
      c as unknown as IConversation,
      c.businessId,
      c.userSideId,
      isBusinessSide ? "business" : "user"
    )
  );

  if (opts.q) {
    const q = opts.q.toLowerCase();
    items = items.filter((c) => c.business.name.toLowerCase().includes(q) || c.user.name.toLowerCase().includes(q));
  }
  return items;
}

export async function assertConversationAccess(conversationId: string, userId: string): Promise<{ conversation: IConversation; side: "user" | "business" }> {
  const conv = await Conversation.findById(conversationId).lean<IConversation | null>();
  if (!conv) throw new ApiError("NOT_FOUND", "Conversation not found", 404);

  if (String(conv.userSideId) === userId) return { conversation: conv, side: "user" };

  const member = await BusinessMember.exists({ businessId: conv.businessId, userId });
  if (member) return { conversation: conv, side: "business" };

  throw new ApiError("FORBIDDEN", "You do not have access to this conversation", 403);
}

export interface MessageView {
  id: string;
  text: string;
  mediaUrl: string | null;
  mine: boolean;
  senderType: "user" | "business";
  readAt: string | null;
  createdAt: string;
}

export async function listMessages(conversationId: string, cursor: string | null, limit: number, viewerId: string): Promise<{ items: MessageView[]; nextCursor: string | null }> {
  await assertConversationAccess(conversationId, viewerId);
  const filter: Record<string, unknown> = { conversationId };
  if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

  const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(limit + 1).lean<IMessage[]>();
  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;

  return {
    items: page.map((m) => ({
      id: String(m._id),
      text: m.text,
      mediaUrl: m.mediaKey ? `/api/media/${m.mediaKey}` : null,
      mine: String(m.senderUserId) === viewerId,
      senderType: m.senderType,
      readAt: m.readAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
    nextCursor: hasMore && page.length > 0 ? String(page[page.length - 1]._id) : null,
  };
}

export async function sendMessage(conversationId: string, userId: string, text: string, mediaKey?: string): Promise<MessageView> {
  const { conversation, side } = await assertConversationAccess(conversationId, userId);

  // Re-check block before every send
  const business = await Business.findById(conversation.businessId).select("ownerUserId").lean();
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);
  const blocked = await Block.exists({
    $or: [
      { blockerId: business.ownerUserId, blockedId: conversation.userSideId },
      { blockerId: conversation.userSideId, blockedId: business.ownerUserId },
    ],
  });
  if (blocked) throw new ApiError("BLOCKED", "Messaging is unavailable between these accounts", 403);

  const message = await Message.create({
    conversationId: conversation._id,
    senderUserId: new Types.ObjectId(userId),
    senderType: side,
    text,
    mediaKey: mediaKey ?? null,
  });

  const preview = text || (mediaKey ? "📷 Photo" : "");
  await Conversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        lastMessage: { text: preview, senderType: side, at: message.createdAt },
        lastMessageAt: message.createdAt,
        archivedByUser: false,
        archivedByBusiness: false,
      },
      $inc: side === "user" ? { unreadForBusiness: 1 } : { unreadForUser: 1 },
    }
  );

  // Notify recipient
  if (side === "user") {
    const members = await BusinessMember.find({ businessId: conversation.businessId }).select("userId").lean();
    const recipients = new Set<string>(members.map((m) => String(m.userId)));
    for (const rid of recipients) {
      if (rid === userId) continue;
      await notify({
        userId: rid,
        type: "message",
        title: "New message",
        body: preview.slice(0, 120),
        url: `/messages?c=${conversationId}`,
        actorUserId: userId,
        businessId: conversation.businessId,
        entityId: conversation._id,
      });
    }
  } else {
    await notify({
      userId: conversation.userSideId,
      type: "message",
      title: "New message",
      body: preview.slice(0, 120),
      url: `/messages?c=${conversationId}`,
      actorUserId: userId,
      businessId: conversation.businessId,
      entityId: conversation._id,
    });
  }

  return {
    id: String(message._id),
    text: message.text,
    mediaUrl: message.mediaKey ? `/api/media/${message.mediaKey}` : null,
    mine: true,
    senderType: message.senderType,
    readAt: null,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function markRead(conversationId: string, userId: string): Promise<void> {
  const { conversation, side } = await assertConversationAccess(conversationId, userId);
  const now = new Date();
  if (side === "user") {
    await Conversation.updateOne({ _id: conversation._id }, { unreadForUser: 0 });
    await Message.updateMany({ conversationId: conversation._id, senderType: "business", readAt: null }, { readAt: now });
  } else {
    await Conversation.updateOne({ _id: conversation._id }, { unreadForBusiness: 0 });
    await Message.updateMany({ conversationId: conversation._id, senderType: "user", readAt: null }, { readAt: now });
  }
}

export async function setArchived(conversationId: string, userId: string, archived: boolean): Promise<void> {
  const { side } = await assertConversationAccess(conversationId, userId);
  await Conversation.updateOne(
    { _id: conversationId },
    side === "user" ? { archivedByUser: archived } : { archivedByBusiness: archived }
  );
}

export async function unreadCounts(viewer: { id: string; managedBusinessIds: string[] }): Promise<{ messages: number; notifications: number }> {
  const { Notification } = await import("@/server/models");
  const [msgFilterConvs, notifCount] = await Promise.all([
    Conversation.find({
      $or: [{ userSideId: viewer.id }, ...(viewer.managedBusinessIds.length ? [{ businessId: { $in: viewer.managedBusinessIds } }] : [])],
    })
      .select("userSideId businessId unreadForUser unreadForBusiness")
      .lean(),
    Notification.countDocuments({ userId: viewer.id, readAt: null }),
  ]);

  let messages = 0;
  for (const c of msgFilterConvs) {
    if (String(c.userSideId) === viewer.id) messages += c.unreadForUser;
    else if (viewer.managedBusinessIds.includes(String(c.businessId))) messages += c.unreadForBusiness;
  }
  return { messages, notifications: notifCount };
}

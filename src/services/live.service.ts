import { Types } from "mongoose";
import { LiveStream, LiveMessage, BusinessMember, Business } from "@/server/models";
import type { ILiveStream } from "@/types";
import { ApiError } from "@/lib/api";
import { notify } from "@/services/notification.service";
import { Follow } from "@/server/models";

/**
 * Live streaming.
 *
 * Integration boundary: video ingest/delivery requires dedicated streaming
 * infrastructure (e.g. Cloudflare Stream, Mux, AWS IVS, YouTube Live). The
 * platform stores the stream's embed URL and owns the business logic around
 * it: lifecycle (start/end), viewer counts, live chat, moderation hooks.
 * Swap the embed for a native player + low-latency HLS when self-hosting.
 */

export async function startLive(userId: string, businessId: string, title: string, embedUrl: string): Promise<ILiveStream> {
  const member = await BusinessMember.exists({ businessId, userId });
  if (!member) throw new ApiError("FORBIDDEN", "You do not manage this business", 403);

  const existing = await LiveStream.findOne({ businessId, status: "live" }).lean();
  if (existing) throw new ApiError("ALREADY_LIVE", "This business is already live", 409);

  const live = await LiveStream.create({ businessId, title, embedUrl });
  const business = await Business.findById(businessId).select("name username").lean();

  // notify followers
  const followers = await Follow.find({ businessId }).select("userId").limit(5000).lean();
  await notifyManySafe(followers.map((f) => String(f.userId)), {
    title: `${business?.name ?? "A business"} is live`,
    body: title,
    url: `/live/${String(live._id)}`,
    businessId,
    entityId: live._id,
  });

  return live.toObject() as ILiveStream;
}

async function notifyManySafe(userIds: string[], input: { title: string; body: string; url: string; businessId: string; entityId: Types.ObjectId }) {
  for (const uid of userIds.slice(0, 2000)) {
    await notify({ userId: uid, type: "live_started", ...input }).catch(() => undefined);
  }
}

export async function endLive(userId: string, liveId: string): Promise<void> {
  const live = await LiveStream.findById(liveId);
  if (!live) throw new ApiError("NOT_FOUND", "Live stream not found", 404);
  const member = await BusinessMember.exists({ businessId: live.businessId, userId });
  if (!member) throw new ApiError("FORBIDDEN", "You do not manage this business", 403);
  if (live.status === "live") {
    live.status = "ended";
    live.endedAt = new Date();
    await live.save();
  }
}

export async function listLive(country?: string | null) {
  const streams = (await LiveStream.find({ status: "live" })
    .sort({ startedAt: -1 })
    .limit(50)
    .populate("businessId", "name username logoKey country")
    .lean()) as unknown as ({
    _id: Types.ObjectId;
    title: string;
    embedUrl: string;
    thumbnailKey: string | null;
    status: "live" | "ended";
    viewers: number;
    peakViewers: number;
    messagesCount: number;
    startedAt: Date;
    endedAt: Date | null;
    businessId: { _id: Types.ObjectId; name: string; username: string; logoKey: string | null; country: string | null };
  })[];

  return streams
    .filter((s) => !country || !s.businessId?.country || s.businessId.country === country)
    .map((s) => ({
      id: String(s._id),
      title: s.title,
      embedUrl: s.embedUrl,
      viewers: s.viewers,
      startedAt: s.startedAt.toISOString(),
      businessName: s.businessId.name,
      businessUsername: s.businessId.username,
      logoUrl: s.businessId.logoKey ? `/api/media/${s.businessId.logoKey}` : null,
    }));
}

export async function getLive(liveId: string): Promise<{ live: ILiveStream; business: { name: string; username: string; logoKey: string | null; verified: boolean } } | null> {
  if (!Types.ObjectId.isValid(liveId)) return null;
  const live = await LiveStream.findById(liveId).lean<ILiveStream | null>();
  if (!live) return null;
  const business = await Business.findById(live.businessId).select("name username logoKey verification").lean();
  if (!business) return null;
  return {
    live,
    business: { name: business.name, username: business.username, logoKey: business.logoKey, verified: business.verification === "verified" },
  };
}

export async function heartbeat(liveId: string, join: boolean): Promise<number> {
  const inc = join ? 1 : -1;
  const live = await LiveStream.findOneAndUpdate(
    { _id: liveId },
    [
      {
        $set: {
          viewers: { $max: [0, { $add: ["$viewers", join ? 1 : -1] }] },
          peakViewers: { $max: ["$peakViewers", { $max: [0, { $add: ["$viewers", inc] }] }] },
        },
      },
    ],
    { new: true }
  ).select("viewers");
  return live?.viewers ?? 0;
}

export interface LiveMessageView {
  id: string;
  text: string;
  author: { name: string; username: string };
  createdAt: string;
}

export async function listLiveMessages(liveId: string, afterId: string | null): Promise<LiveMessageView[]> {
  const filter: Record<string, unknown> = { liveStreamId: liveId };
  if (afterId && Types.ObjectId.isValid(afterId)) filter._id = { $gt: new Types.ObjectId(afterId) };
  const messages = (await LiveMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("userId", "name username")
    .lean()) as unknown as { _id: Types.ObjectId; text: string; createdAt: Date; userId: { name: string; username: string } }[];
  return messages.reverse().map((m) => ({
    id: String(m._id),
    text: m.text,
    author: { name: m.userId.name, username: m.userId.username },
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function sendLiveMessage(liveId: string, userId: string, text: string): Promise<LiveMessageView> {
  const live = await LiveStream.findOne({ _id: liveId, status: "live" }).select("_id").lean();
  if (!live) throw new ApiError("NOT_FOUND", "This live has ended", 404);
  const message = await LiveMessage.create({ liveStreamId: liveId, userId, text });
  await LiveStream.updateOne({ _id: liveId }, { $inc: { messagesCount: 1 } });
  const user = await import("@/server/models").then((m) => m.User.findById(userId).select("name username").lean());
  return {
    id: String(message._id),
    text: message.text,
    author: { name: user?.name ?? "?", username: user?.username ?? "?" },
    createdAt: message.createdAt.toISOString(),
  };
}

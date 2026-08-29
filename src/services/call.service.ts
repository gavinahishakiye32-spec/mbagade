import { Types } from "mongoose";
import { Call, CallSignal, Business, Block, User } from "@/server/models";
import type { ICall } from "@/types";
import { ApiError } from "@/lib/api";
import { notify } from "@/services/notification.service";

/**
 * WebRTC calling with database-backed signaling.
 * The WebRTC media path is peer-to-peer (STUN/TURN); only signaling
 * (offer/answer/ICE candidates) transits this server. For production scale,
 * swap the signaling transport for a WebSocket gateway — the call model and
 * client flow stay identical.
 */

export async function startCall(callerId: string, businessId: string, type: "voice" | "video"): Promise<ICall> {
  const business = await Business.findOne({ _id: businessId, status: "active" }).select("ownerUserId allowCalls username").lean();
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);
  if (!business.allowCalls) throw new ApiError("CALLS_DISABLED", "This business does not accept calls", 403);
  if (String(business.ownerUserId) === callerId) throw new ApiError("INVALID_INPUT", "You cannot call your own business", 422);

  const blocked = await Block.exists({
    $or: [
      { blockerId: business.ownerUserId, blockedId: callerId },
      { blockerId: callerId, blockedId: business.ownerUserId },
    ],
  });
  if (blocked) throw new ApiError("BLOCKED", "Calling is unavailable between these accounts", 403);

  // one active ringing call per pair
  await Call.updateMany(
    { callerUserId: callerId, calleeUserId: business.ownerUserId, status: "ringing" },
    { status: "cancelled", endedAt: new Date() }
  );

  const call = await Call.create({
    callerUserId: new Types.ObjectId(callerId),
    calleeUserId: business.ownerUserId,
    businessId: business._id,
    type,
  });

  await notify({
    userId: business.ownerUserId,
    type: "call_incoming",
    title: `Incoming ${type} call`,
    body: "Tap to answer",
    url: `/calls/${String(call._id)}`,
    actorUserId: callerId,
    businessId: business._id,
    entityId: call._id,
  });

  return call.toObject() as ICall;
}

export async function getCallForViewer(callId: string, userId: string): Promise<ICall> {
  if (!Types.ObjectId.isValid(callId)) throw new ApiError("NOT_FOUND", "Call not found", 404);
  const call = await Call.findById(callId).lean<ICall | null>();
  if (!call) throw new ApiError("NOT_FOUND", "Call not found", 404);
  if (String(call.callerUserId) !== userId && String(call.calleeUserId) !== userId)
    throw new ApiError("FORBIDDEN", "Not a participant of this call", 403);
  return call;
}

export async function respondToCall(callId: string, userId: string, action: "accept" | "reject" | "end"): Promise<ICall> {
  const existing = await getCallForViewer(callId, userId);
  const call = await Call.findById(callId);
  if (!call) throw new ApiError("NOT_FOUND", "Call not found", 404);

  if (action === "accept") {
    if (String(existing.calleeUserId) !== userId) throw new ApiError("FORBIDDEN", "Only the receiver can accept", 403);
    if (call.status !== "ringing") throw new ApiError("INVALID_STATUS", `Call is ${call.status}`, 422);
    call.status = "accepted";
    call.startedAt = new Date();
  } else if (action === "reject") {
    if (call.status !== "ringing") throw new ApiError("INVALID_STATUS", `Call is ${call.status}`, 422);
    call.status = "rejected";
    call.endedAt = new Date();
    await notify({
      userId: call.callerUserId,
      type: "call_missed",
      title: "Call declined",
      url: `/messages`,
      entityId: call._id,
    });
  } else {
    if (["ringing", "accepted"].includes(call.status)) {
      if (call.status === "ringing") {
        call.status = "missed";
        await notify({
          userId: String(call.callerUserId) === userId ? call.calleeUserId : call.callerUserId,
          type: "call_missed",
          title: "Missed call",
          url: `/messages`,
          entityId: call._id,
        });
      } else {
        call.status = "ended";
        call.durationSec = Math.floor(((call.endedAt ?? new Date()).getTime() - (call.startedAt?.getTime() ?? Date.now())) / 1000);
      }
      call.endedAt = new Date();
    }
  }
  await call.save();
  return call.toObject() as ICall;
}

export async function incomingCalls(userId: string): Promise<ICall[]> {
  return Call.find({ calleeUserId: userId, status: "ringing", createdAt: { $gte: new Date(Date.now() - 60_000) } })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean<ICall[]>();
}

export async function callHistory(userId: string): Promise<(ICall & { peerName: string })[]> {
  const calls = await Call.find({ $or: [{ callerUserId: userId }, { calleeUserId: userId }] })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean<ICall[]>();
  const peerIds = [...new Set(calls.map((c) => (String(c.callerUserId) === userId ? String(c.calleeUserId) : String(c.callerUserId))))];
  const users = await User.find({ _id: { $in: peerIds } }).select("name").lean();
  const nameById = new Map(users.map((u) => [String(u._id), u.name]));
  return calls.map((c) => ({
    ...c,
    peerName:
      nameById.get(String(c.callerUserId) === userId ? String(c.calleeUserId) : String(c.callerUserId)) ?? "Unknown",
  }));
}

/* ---------- Signaling ---------- */

export async function pushSignal(callId: string, fromUserId: string, kind: "offer" | "answer" | "candidate", data: unknown): Promise<void> {
  const call = await getCallForViewer(callId, fromUserId);
  if (!["ringing", "accepted"].includes(call.status)) throw new ApiError("INVALID_STATUS", "Call is not active", 422);
  await CallSignal.create({ callId: call._id, fromUserId: new Types.ObjectId(fromUserId), payload: { kind, data } });
}

export async function pullSignals(callId: string, afterId: string | null, userId: string) {
  await getCallForViewer(callId, userId);
  const filter: Record<string, unknown> = { callId };
  if (afterId && Types.ObjectId.isValid(afterId)) filter._id = { $gt: new Types.ObjectId(afterId) };
  else filter.fromUserId = { $ne: new Types.ObjectId(userId) };

  const signals = await CallSignal.find(filter).sort({ createdAt: 1 }).limit(100).lean();
  return signals.map((s) => ({
    id: String(s._id),
    fromMe: String(s.fromUserId) === userId,
    kind: s.payload.kind,
    data: s.payload.data,
  }));
}

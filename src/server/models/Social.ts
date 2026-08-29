import mongoose, { Schema } from "mongoose";
import type {
  IConversation,
  IMessage,
  ICall,
  ICallSignal,
  ILiveStream,
  ILiveMessage,
  INotification,
  IReport,
  IAnalyticsEvent,
} from "@/types";

const conversationSchema = new Schema<IConversation>(
  {
    userSideId: { type: Schema.Types.ObjectId, required: true },
    businessId: { type: Schema.Types.ObjectId, required: true },
    lastMessage: { text: String, senderType: String, at: Date },
    unreadForUser: { type: Number, default: 0 },
    unreadForBusiness: { type: Number, default: 0 },
    archivedByUser: { type: Boolean, default: false },
    archivedByBusiness: { type: Boolean, default: false },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
conversationSchema.index({ userSideId: 1, businessId: 1 }, { unique: true });
conversationSchema.index({ businessId: 1, lastMessageAt: -1 });
conversationSchema.index({ userSideId: 1, lastMessageAt: -1 });

export const Conversation =
  mongoose.models.Conversation ?? mongoose.model<IConversation>("Conversation", conversationSchema);

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, required: true, index: true },
    senderUserId: { type: Schema.Types.ObjectId, required: true },
    senderType: { type: String, enum: ["user", "business"], required: true },
    text: { type: String, default: "", maxlength: 4000 },
    mediaKey: { type: String, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
messageSchema.index({ conversationId: 1, createdAt: -1 });

export const Message = mongoose.models.Message ?? mongoose.model<IMessage>("Message", messageSchema);

const callSchema = new Schema<ICall>(
  {
    callerUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    calleeUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, default: null },
    type: { type: String, enum: ["voice", "video"], required: true },
    status: { type: String, enum: ["ringing", "accepted", "rejected", "ended", "missed", "cancelled"], default: "ringing", index: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationSec: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
callSchema.index({ calleeUserId: 1, status: 1 });
callSchema.index({ createdAt: -1 });

export const Call = mongoose.models.Call ?? mongoose.model<ICall>("Call", callSchema);

const callSignalSchema = new Schema<ICallSignal>(
  {
    callId: { type: Schema.Types.ObjectId, required: true, index: true },
    fromUserId: { type: Schema.Types.ObjectId, required: true },
    payload: {
      kind: { type: String, enum: ["offer", "answer", "candidate"] },
      data: Schema.Types.Mixed,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
callSignalSchema.index({ callId: 1, createdAt: 1 });

export const CallSignal = mongoose.models.CallSignal ?? mongoose.model<ICallSignal>("CallSignal", callSignalSchema);

const liveStreamSchema = new Schema<ILiveStream>(
  {
    businessId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    embedUrl: { type: String, required: true },
    thumbnailKey: { type: String, default: null },
    status: { type: String, enum: ["live", "ended"], default: "live", index: true },
    viewers: { type: Number, default: 0 },
    peakViewers: { type: Number, default: 0 },
    messagesCount: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
liveStreamSchema.index({ status: 1, startedAt: -1 });

export const LiveStream =
  mongoose.models.LiveStream ?? mongoose.model<ILiveStream>("LiveStream", liveStreamSchema);

const liveMessageSchema = new Schema<ILiveMessage>(
  {
    liveStreamId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
liveMessageSchema.index({ liveStreamId: 1, createdAt: -1 });

export const LiveMessage =
  mongoose.models.LiveMessage ?? mongoose.model<ILiveMessage>("LiveMessage", liveMessageSchema);

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, required: true },
    actorUserId: { type: Schema.Types.ObjectId, default: null },
    businessId: { type: Schema.Types.ObjectId, default: null },
    postId: { type: Schema.Types.ObjectId, default: null },
    entityId: { type: Schema.Types.ObjectId, default: null },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    url: { type: String, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification ?? mongoose.model<INotification>("Notification", notificationSchema);

const reportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, required: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, required: true },
    details: { type: String, default: "" },
    status: { type: String, enum: ["open", "actioned", "dismissed"], default: "open", index: true },
    resolution: { type: String, default: null },
    resolvedByUserId: { type: Schema.Types.ObjectId, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.models.Report ?? mongoose.model<IReport>("Report", reportSchema);

const analyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    type: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, default: null },
    businessId: { type: Schema.Types.ObjectId, default: null },
    postId: { type: Schema.Types.ObjectId, default: null },
    productId: { type: Schema.Types.ObjectId, default: null },
    advertisementId: { type: Schema.Types.ObjectId, default: null },
    valueMs: { type: Number, default: 0 },
    country: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
analyticsEventSchema.index({ businessId: 1, type: 1, createdAt: -1 });
analyticsEventSchema.index({ postId: 1, type: 1 });
analyticsEventSchema.index({ createdAt: -1 });

export const AnalyticsEvent =
  mongoose.models.AnalyticsEvent ?? mongoose.model<IAnalyticsEvent>("AnalyticsEvent", analyticsEventSchema);

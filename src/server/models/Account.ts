import mongoose, { Schema } from "mongoose";
import type { ISession, IToken, IAuditLog, IPlatformSetting } from "@/types";

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Session = mongoose.models.Session ?? mongoose.model<ISession>("Session", sessionSchema);

const tokenSchema = new Schema<IToken>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  kind: { type: String, enum: ["email_verify", "password_reset"], required: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
});

export const Token = mongoose.models.Token ?? mongoose.model<IToken>("Token", tokenSchema);

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, default: null },
    detail: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.models.AuditLog ?? mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

const platformSettingSchema = new Schema<IPlatformSetting>({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, default: null },
  updatedByUserId: { type: Schema.Types.ObjectId, default: null },
  updatedAt: { type: Date, default: Date.now },
});

export const PlatformSetting =
  mongoose.models.PlatformSetting ?? mongoose.model<IPlatformSetting>("PlatformSetting", platformSettingSchema);

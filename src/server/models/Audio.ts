import mongoose, { Schema } from "mongoose";
import type { ISound } from "@/types";

/**
 * TikTok-style sound library. Users can upload a short audio clip, attach it to
 * their videos, and others can "use this sound" on their own posts.
 */
const soundSchema = new Schema<ISound>(
  {
    creatorUserId: { type: Schema.Types.ObjectId, default: null, index: true },
    businessId: { type: Schema.Types.ObjectId, default: null, index: true },
    title: { type: String, required: true, maxlength: 140 },
    artist: { type: String, default: "", maxlength: 140 },
    audioKey: { type: String, required: true },
    coverKey: { type: String, default: null },
    usesCount: { type: Number, default: 0 },
    durationSec: { type: Number, default: 0 },
    official: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "hidden", "removed"], default: "active", index: true },
  },
  { timestamps: true }
);
soundSchema.index({ status: 1, usesCount: -1 });
soundSchema.index({ status: 1, createdAt: -1 });
soundSchema.index({ title: "text", artist: "text" });

export const Sound = mongoose.models.Sound ?? mongoose.model<ISound>("Sound", soundSchema);

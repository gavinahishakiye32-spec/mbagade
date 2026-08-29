import mongoose, { Schema } from "mongoose";
import type { IUser } from "@/types";
import { NOTIFICATION_TYPES } from "@/config/constants";

const notificationDefaults = Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, true])) as Record<
  (typeof NOTIFICATION_TYPES)[number],
  boolean
>;

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerifiedAt: { type: Date, default: null },
    passwordHash: { type: String, default: null },
    name: { type: String, required: true },
    avatarKey: { type: String, default: null },
    bio: { type: String, default: "", maxlength: 500 },
    country: { type: String, default: null },
    city: { type: String, default: null },
    role: { type: String, enum: ["customer", "business", "admin"], default: "customer" },
    oauthAccounts: [
      {
        provider: { type: String, enum: ["google", "facebook"] },
        providerAccountId: String,
        email: String,
        linkedAt: Date,
      },
    ],
    lastLoginAt: { type: Date, default: null },
    loginFailures: {
      count: { type: Number, default: 0 },
      lockedUntil: { type: Date, default: null },
    },
    status: { type: String, enum: ["active", "suspended", "banned", "deleted"], default: "active" },
    suspendedReason: { type: String, default: null },
    isFoundingCustomer: { type: Boolean, default: false, index: true },
    foundingCustomerAt: { type: Date, default: null },
    referralCode: { type: String, default: null },
    referredByUserId: { type: Schema.Types.ObjectId, default: null },
    followersCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },
    settings: {
      notifications: { type: Map, of: Boolean, default: notificationDefaults },
      allowCalls: { type: Boolean, default: true },
      allowMessagesFromAnyone: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

userSchema.index({ name: "text" });
// Unique only for users that actually have a code — nulls must never collide
// (a sparse index still indexes explicit null values, so use a partial filter).
userSchema.index(
  { referralCode: 1 },
  { unique: true, partialFilterExpression: { referralCode: { $type: "string" } } }
);

export const User =
  mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);

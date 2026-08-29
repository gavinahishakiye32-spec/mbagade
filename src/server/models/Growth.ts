import mongoose, { Schema } from "mongoose";
import type { IClaimRequest, IOffer, IReferral, IWaitlistEntry } from "@/types";

/**
 * Launch-phase & growth entities (development addendum):
 * offers/promotions, referrals, pre-launch waitlist and business claiming.
 */

const offerSchema = new Schema<IOffer>(
  {
    businessId: { type: Schema.Types.ObjectId, required: true, index: true, ref: "Business" },
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 2000 },
    mediaKeys: [{ type: String }],
    discountLabel: { type: String, required: true, maxlength: 60 },
    priceCents: { type: Number, default: null },
    currency: { type: String, default: null },
    productId: { type: Schema.Types.ObjectId, default: null },
    terms: { type: String, default: "", maxlength: 1000 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    city: { type: String, default: null, index: true },
    country: { type: String, default: null, index: true },
    status: { type: String, enum: ["draft", "active", "paused"], default: "active" },
    clicksCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
offerSchema.index({ status: 1, startsAt: 1, endsAt: -1 });
offerSchema.index({ country: 1, city: 1, status: 1 });

export const Offer = mongoose.models.Offer ?? mongoose.model<IOffer>("Offer", offerSchema);

const referralSchema = new Schema<IReferral>(
  {
    type: { type: String, enum: ["customer", "business"], required: true },
    referrerUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, required: true, unique: true },
    invitedEmail: { type: String, default: null },
    referredUserId: { type: Schema.Types.ObjectId, default: null },
    status: { type: String, enum: ["pending", "completed", "rewarded"], default: "pending", index: true },
    completedAt: { type: Date, default: null },
    rewardedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
referralSchema.index({ referredUserId: 1 });

export const Referral = mongoose.models.Referral ?? mongoose.model<IReferral>("Referral", referralSchema);

const waitlistEntrySchema = new Schema<IWaitlistEntry>(
  {
    type: { type: String, enum: ["customer", "business"], required: true },
    name: { type: String, required: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    country: { type: String, default: null },
    city: { type: String, default: null },
    businessName: { type: String, default: null },
    category: { type: String, default: null },
    status: { type: String, enum: ["pending", "invited", "converted"], default: "pending", index: true },
    userId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
waitlistEntrySchema.index({ email: 1, type: 1 }, { unique: true });

export const WaitlistEntry =
  mongoose.models.WaitlistEntry ?? mongoose.model<IWaitlistEntry>("WaitlistEntry", waitlistEntrySchema);

const claimRequestSchema = new Schema<IClaimRequest>(
  {
    businessId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    note: { type: String, default: "", maxlength: 2000 },
    docFileKey: { type: String, default: null },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    reviewNote: { type: String, default: null },
    reviewedByUserId: { type: Schema.Types.ObjectId, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
claimRequestSchema.index({ businessId: 1, userId: 1, status: 1 });

export const ClaimRequest =
  mongoose.models.ClaimRequest ?? mongoose.model<IClaimRequest>("ClaimRequest", claimRequestSchema);

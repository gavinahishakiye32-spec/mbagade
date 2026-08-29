import mongoose, { Schema } from "mongoose";
import type { IBusiness, IBusinessMember, ICategory, IVerificationRequest, IReview, IBlock } from "@/types";

const businessSchema = new Schema<IBusiness>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, required: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    description: { type: String, default: "", maxlength: 5000 },
    logoKey: { type: String, default: null },
    coverKey: { type: String, default: null },
    category: { type: String, required: true, index: true },
    subcategory: { type: String, default: "" },
    country: { type: String, default: null, index: true },
    region: { type: String, default: null },
    city: { type: String, default: null, index: true },
    address: { type: String, default: null },
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    whatsapp: { type: String, default: null },
    website: { type: String, default: null },
    socialLinks: [{ platform: String, url: String }],
    openingHours: [
      {
        open: String,
        close: String,
        closed: Boolean,
      },
    ],
    verification: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected", "suspended"],
      default: "unverified",
      index: true,
    },
    verifiedAt: { type: Date, default: null },
    followersCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },
    productsCount: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    contactClicks: { type: Number, default: 0 },
    websiteClicks: { type: Number, default: 0 },
    whatsappClicks: { type: Number, default: 0 },
    allowCalls: { type: Boolean, default: true },
    allowOrders: { type: Boolean, default: true },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    isFoundingBusiness: { type: Boolean, default: false, index: true },
    foundingBusinessAt: { type: Date, default: null },
    claimStatus: {
      type: String,
      enum: ["n/a", "unclaimed", "pending", "claimed"],
      default: "claimed",
      index: true,
    },
    createdByAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

businessSchema.index({ name: "text", description: "text", category: "text", city: "text", country: "text" });
businessSchema.index({ location: "2dsphere" });
businessSchema.index({ followersCount: -1 });
businessSchema.index({ createdAt: -1 });

export const Business = mongoose.models.Business ?? mongoose.model<IBusiness>("Business", businessSchema);

const businessMemberSchema = new Schema<IBusinessMember>(
  {
    businessId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ["owner", "manager", "editor"], required: true },
    invitedByUserId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
businessMemberSchema.index({ businessId: 1, userId: 1 }, { unique: true });
businessMemberSchema.index({ userId: 1 });

export const BusinessMember =
  mongoose.models.BusinessMember ?? mongoose.model<IBusinessMember>("BusinessMember", businessMemberSchema);

const categorySchema = new Schema<ICategory>({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  icon: { type: String, default: "store" },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
});

export const Category = mongoose.models.Category ?? mongoose.model<ICategory>("Category", categorySchema);

const verificationRequestSchema = new Schema<IVerificationRequest>(
  {
    businessId: { type: Schema.Types.ObjectId, required: true, index: true },
    submittedByUserId: { type: Schema.Types.ObjectId, required: true },
    documents: [{ type: String, fileKey: String, label: String }],
    registrationNumber: { type: String, required: true },
    note: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    reviewedByUserId: { type: Schema.Types.ObjectId, default: null },
    reviewNote: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const VerificationRequest =
  mongoose.models.VerificationRequest ??
  mongoose.model<IVerificationRequest>("VerificationRequest", verificationRequestSchema);

const reviewSchema = new Schema<IReview>(
  {
    businessId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    orderId: { type: Schema.Types.ObjectId, default: null },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, default: "", maxlength: 2000 },
    status: { type: String, enum: ["visible", "removed"], default: "visible" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
reviewSchema.index({ businessId: 1, userId: 1 }, { unique: true });

export const Review = mongoose.models.Review ?? mongoose.model<IReview>("Review", reviewSchema);

const blockSchema = new Schema<IBlock>(
  {
    blockerId: { type: Schema.Types.ObjectId, required: true },
    blockedId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
blockSchema.index({ blockedId: 1 });

export const Block = mongoose.models.Block ?? mongoose.model<IBlock>("Block", blockSchema);

import mongoose, { Schema } from "mongoose";
import type { IPost, IComment, ILike, IFollow, ISavedPost } from "@/types";

const postSchema = new Schema<IPost>(
  {
    businessId: { type: Schema.Types.ObjectId, required: false, default: null, index: true },
    authorUserId: { type: Schema.Types.ObjectId, required: true },
    authorType: { type: String, enum: ["user", "business"], required: true, default: "business", index: true },
    type: { type: String, enum: ["text", "image", "video"], required: true },
    caption: { type: String, default: "", maxlength: 2200 },
    hashtags: [{ type: String, lowercase: true }],
    mediaKeys: [String],
    thumbnailKey: { type: String, default: null },
    soundId: { type: Schema.Types.ObjectId, default: null, ref: "Sound", index: true },
    productIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    city: { type: String, default: null, index: true },
    country: { type: String, default: null },
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
    visibility: { type: String, enum: ["public", "followers"], default: "public" },
    status: { type: String, enum: ["published", "under_review", "removed"], default: "published", index: true },
    moderation: {
      source: String,
      flagged: Boolean,
      reasons: [String],
    },
    viewsCount: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    savesCount: { type: Number, default: 0 },
    followsGenerated: { type: Number, default: 0 },
    productClicks: { type: Number, default: 0 },
    contactClicks: { type: Number, default: 0 },
    reportsCount: { type: Number, default: 0 },
    scoreCache: { type: Number, default: 0 },
    scoreUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ businessId: 1, createdAt: -1 });
postSchema.index({ authorUserId: 1, createdAt: -1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ scoreCache: -1 });
postSchema.index({ status: 1, createdAt: -1 });

export const Post = mongoose.models.Post ?? mongoose.model<IPost>("Post", postSchema);

const commentSchema = new Schema<IComment>(
  {
    postId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    parentId: { type: Schema.Types.ObjectId, default: null, index: true },
    text: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: ["visible", "removed"], default: "visible" },
    likesCount: { type: Number, default: 0 },
    repliesCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
commentSchema.index({ postId: 1, createdAt: -1 });

export const Comment = mongoose.models.Comment ?? mongoose.model<IComment>("Comment", commentSchema);

const likeSchema = new Schema<ILike>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    postId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
likeSchema.index({ userId: 1, postId: 1 }, { unique: true });
likeSchema.index({ postId: 1 });

export const Like = mongoose.models.Like ?? mongoose.model<ILike>("Like", likeSchema);

const followSchema = new Schema<IFollow>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    businessId: { type: Schema.Types.ObjectId, required: false, default: null },
    followedUserId: { type: Schema.Types.ObjectId, required: false, default: null },
    followingType: { type: String, enum: ["user", "business"], required: true, default: "business", index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
followSchema.index({ userId: 1, businessId: 1 }, { unique: true, partialFilterExpression: { businessId: { $type: "objectId" } } });
followSchema.index({ userId: 1, followedUserId: 1 }, { unique: true, partialFilterExpression: { followedUserId: { $type: "objectId" } } });
followSchema.index({ businessId: 1 });
followSchema.index({ followedUserId: 1 });

export const Follow = mongoose.models.Follow ?? mongoose.model<IFollow>("Follow", followSchema);

const savedPostSchema = new Schema<ISavedPost>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    postId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
savedPostSchema.index({ userId: 1, postId: 1 }, { unique: true });
savedPostSchema.index({ userId: 1, createdAt: -1 });

export const SavedPost = mongoose.models.SavedPost ?? mongoose.model<ISavedPost>("SavedPost", savedPostSchema);

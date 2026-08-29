import { Types } from "mongoose";
import { Post, Business, BusinessMember, Like, Comment, SavedPost, Block, User } from "@/server/models";
import type { IPost, IComment } from "@/types";
import { ApiError } from "@/lib/api";
import { moderateContent } from "@/services/moderation.service";
import { extractHashtags } from "@/services/feed-scoring";
import { notify } from "@/services/notification.service";
import { track } from "@/services/analytics.service";
import { recordSoundUse } from "@/services/sound.service";

export interface CreatePostInput {
  type: "text" | "image" | "video";
  caption: string;
  mediaKeys: string[];
  thumbnailKey?: string;
  soundId?: string | null;
  hashtags?: string[];
  productIds?: string[];
  visibility: "public" | "followers";
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

async function assertCanManageBusiness(userId: string, businessId: string) {
  const member = await BusinessMember.findOne({ businessId, userId }).lean();
  if (!member) throw new ApiError("FORBIDDEN", "You do not manage this business", 403);
}

export async function createPost(
  userId: string,
  businessId: string | null,
  input: CreatePostInput
): Promise<IPost> {
  if (businessId) await assertCanManageBusiness(userId, businessId);

  if (input.type === "video" && input.mediaKeys.length === 0)
    throw new ApiError("INVALID_INPUT", "Video posts require a video file", 422);
  if (input.type === "image" && input.mediaKeys.length === 0)
    throw new ApiError("INVALID_INPUT", "Image posts require at least one image", 422);

  const authorType = businessId ? ("business" as const) : ("user" as const);

  let businessCity: string | null = null;
  let businessCountry: string | null = null;
  if (businessId) {
    const business = await Business.findById(businessId).lean();
    if (!business || business.status !== "active") throw new ApiError("NOT_FOUND", "Business not found", 404);
    businessCity = business.city ?? null;
    businessCountry = business.country ?? null;
  } else {
    const user = await User.findById(userId).lean();
    if (!user || user.status !== "active") throw new ApiError("FORBIDDEN", "Account unavailable", 403);
    businessCity = user.city ?? null;
    businessCountry = user.country ?? null;
  }

  // Moderation pipeline (keyword + AI when configured). Flagged → under_review.
  const verdict = await moderateContent(input.caption);
  const status = verdict.flagged ? ("under_review" as const) : ("published" as const);

  const mergedTags = [...new Set([...(input.hashtags ?? []), ...extractHashtags(input.caption)])].slice(0, 20);

  const post = await Post.create({
    businessId: businessId ? new Types.ObjectId(businessId) : null,
    authorUserId: new Types.ObjectId(userId),
    authorType,
    type: input.type,
    caption: input.caption,
    hashtags: mergedTags,
    mediaKeys: input.mediaKeys,
    thumbnailKey: input.thumbnailKey ?? null,
    soundId: input.soundId ? new Types.ObjectId(input.soundId) : null,
    productIds: (input.productIds ?? []).map((id) => new Types.ObjectId(id)),
    city: input.city ?? businessCity ?? null,
    country: input.country ?? businessCountry ?? null,
    location:
      input.latitude != null && input.longitude != null
        ? { type: "Point" as const, coordinates: [input.longitude, input.latitude] }
        : null,
    visibility: input.visibility,
    status,
    moderation: { source: verdict.source, flagged: verdict.flagged, reasons: verdict.reasons },
  });

  if (input.soundId) void recordSoundUse(input.soundId);

  if (authorType === "business" && post.businessId) {
    await Business.updateOne({ _id: post.businessId }, { $inc: { postsCount: 1 } });
  } else {
    await User.updateOne({ _id: post.authorUserId }, { $inc: { postsCount: 1 } });
  }
  return post;
}

export async function updatePost(userId: string, postId: string, patch: Partial<CreatePostInput>): Promise<IPost> {
  const post = await Post.findById(postId);
  if (!post || post.status === "removed") throw new ApiError("NOT_FOUND", "Post not found", 404);
  if (post.authorType === "business" && post.businessId) {
    await assertCanManageBusiness(userId, String(post.businessId));
  } else if (String(post.authorUserId) !== userId) {
    throw new ApiError("FORBIDDEN", "You can only edit your own posts", 403);
  }

  if (patch.caption !== undefined) {
    post.caption = patch.caption;
    const tags = extractHashtags(patch.caption);
    if (tags.length > 0) post.hashtags = [...new Set([...(post.hashtags ?? []), ...tags])].slice(0, 20);
    const verdict = await moderateContent(patch.caption);
    if (verdict.flagged) {
      post.status = "under_review";
      post.moderation = { source: verdict.source, flagged: true, reasons: verdict.reasons };
    }
  }
  if (patch.visibility) post.visibility = patch.visibility;
  if (patch.productIds) post.productIds = patch.productIds.map((id) => new Types.ObjectId(id));
  await post.save();
  return post;
}

export async function deletePost(userId: string, postId: string): Promise<void> {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError("NOT_FOUND", "Post not found", 404);
  if (post.authorType === "business" && post.businessId) {
    await assertCanManageBusiness(userId, String(post.businessId));
  } else if (String(post.authorUserId) !== userId) {
    throw new ApiError("FORBIDDEN", "You can only delete your own posts", 403);
  }
  post.status = "removed";
  await post.save();
  if (post.authorType === "business" && post.businessId) {
    await Business.updateOne({ _id: post.businessId }, { $inc: { postsCount: -1 } });
  } else {
    await User.updateOne({ _id: post.authorUserId }, { $inc: { postsCount: -1 } });
  }
}

/* ---------- Interactions ---------- */

export async function toggleLike(userId: string, postId: string): Promise<{ liked: boolean; likesCount: number }> {
  const post = await Post.findOne({ _id: postId, status: "published" });
  if (!post) throw new ApiError("NOT_FOUND", "Post not found", 404);

  const existing = await Like.findOne({ userId, postId });
  if (existing) {
    await existing.deleteOne();
    const updated = await Post.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } }, { new: true }).select("likesCount");
    return { liked: false, likesCount: updated?.likesCount ?? 0 };
  }

  await Like.create({ userId, postId });
  const updated = await Post.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } }, { new: true }).select("likesCount");

  if (String(post.authorUserId) !== userId) {
    await notify({
      userId: post.authorUserId,
      type: "like",
      title: "New like",
      body: `Someone liked your post`,
      url: `/`,
      actorUserId: userId,
      businessId: post.businessId,
      postId: post._id,
    });
  }
  return { liked: true, likesCount: updated?.likesCount ?? 0 };
}

export async function toggleSave(userId: string, postId: string): Promise<{ saved: boolean }> {
  const post = await Post.findOne({ _id: postId, status: "published" }).select("_id");
  if (!post) throw new ApiError("NOT_FOUND", "Post not found", 404);

  const existing = await SavedPost.findOne({ userId, postId });
  if (existing) {
    await existing.deleteOne();
    await Post.updateOne({ _id: postId }, { $inc: { savesCount: -1 } });
    return { saved: false };
  }
  await SavedPost.create({ userId, postId });
  await Post.updateOne({ _id: postId }, { $inc: { savesCount: 1 } });
  return { saved: true };
}

export async function sharePost(userId: string | null, postId: string): Promise<{ sharesCount: number }> {
  const updated = await Post.findOneAndUpdate(
    { _id: postId, status: "published" },
    { $inc: { sharesCount: 1 } },
    { new: true }
  ).select("sharesCount");
  if (!updated) throw new ApiError("NOT_FOUND", "Post not found", 404);
  if (userId) void track({ type: "share", userId, postId: updated._id });
  return { sharesCount: updated.sharesCount };
}

const SPAM_INTERVAL_MS = 2500;

export async function addComment(
  userId: string,
  postId: string,
  text: string,
  parentId?: string
): Promise<IComment> {
  const user = await User.findById(userId).select("_id status").lean<{ _id: Types.ObjectId; status: string } | null>();
  if (!user || user.status !== "active") throw new ApiError("FORBIDDEN", "Account unavailable", 403);
  const post = await Post.findOne({ _id: postId, status: "published" });
  if (!post) throw new ApiError("NOT_FOUND", "Post not found", 404);

  // Anti-spam: rate interval + duplicate suppression + block check
  const recent = await Comment.findOne({
    userId,
    createdAt: { $gte: new Date(Date.now() - SPAM_INTERVAL_MS) },
  }).lean();
  if (recent) throw new ApiError("RATE_LIMITED", "Please wait a moment before commenting again", 429);

  const duplicate = await Comment.findOne({ userId, text, postId, createdAt: { $gte: new Date(Date.now() - 60_000) } }).lean();
  if (duplicate) throw new ApiError("DUPLICATE_COMMENT", "You already posted this comment", 422);

  const blocked = await Block.exists({ $or: [{ blockerId: post.authorUserId, blockedId: userId }, { blockerId: userId, blockedId: post.authorUserId }] });
  if (blocked) throw new ApiError("BLOCKED", "You cannot comment on this post", 403);

  let parent = null as IComment | null;
  if (parentId) {
    parent = await Comment.findOne({ _id: parentId, postId, status: "visible" }).lean<IComment | null>();
    if (!parent) throw new ApiError("NOT_FOUND", "Parent comment not found", 404);
  }

  const verdict = await moderateContent(text);
  const comment = await Comment.create({
    postId: post._id,
    userId: user._id,
    parentId: parent ? parent._id : null,
    text,
    status: verdict.flagged ? "removed" : "visible",
  });

  if (!verdict.flagged) {
    await Post.updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } });
    if (parent) await Comment.updateOne({ _id: parent._id }, { $inc: { repliesCount: 1 } });

    const recipient = parent ? parent.userId : post.authorUserId;
    if (String(recipient) !== userId) {
      await notify({
        userId: recipient,
        type: parent ? "reply" : "comment",
        title: parent ? "New reply" : "New comment",
        body: text.slice(0, 120),
        url: `/`,
        actorUserId: userId,
        postId: post._id,
        entityId: comment._id,
      });
    }
  }
  return comment;
}

export async function deleteComment(userId: string, commentId: string): Promise<void> {
  const comment = await Comment.findById(commentId);
  if (!comment || comment.status === "removed") throw new ApiError("NOT_FOUND", "Comment not found", 404);

  const post = await Post.findById(comment.postId).select("businessId authorUserId authorType").lean();
  if (!post) throw new ApiError("NOT_FOUND", "Post not found", 404);

  const isAuthor = String(comment.userId) === userId;
  let isPostOwner = false;
  if (!isAuthor) {
    if (post.authorType === "business" && post.businessId) {
      const membership = await BusinessMember.exists({ businessId: post.businessId, userId });
      isPostOwner = Boolean(membership) || String(post.authorUserId) === userId;
    } else {
      isPostOwner = String(post.authorUserId) === userId;
    }
  }
  if (!isAuthor && !isPostOwner) throw new ApiError("FORBIDDEN", "You cannot delete this comment", 403);

  comment.status = "removed";
  await comment.save();
  await Post.updateOne({ _id: comment.postId }, { $inc: { commentsCount: -1 } });
  if (comment.parentId) await Comment.updateOne({ _id: comment.parentId }, { $inc: { repliesCount: -1 } });
}

export interface CommentView {
  id: string;
  text: string;
  parentId: string | null;
  repliesCount: number;
  author: { id: string; name: string; username: string; avatarUrl: string | null };
  isOwn: boolean;
  createdAt: string;
}

export async function listComments(postId: string, cursor: string | null, limit: number, viewerId: string | null) {
  const filter: Record<string, unknown> = { postId, status: "visible", parentId: null };
  if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };
  const comments = (await Comment.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate("userId", "name username avatarKey")
    .lean()) as unknown as {
    _id: Types.ObjectId;
    text: string;
    parentId: Types.ObjectId | null;
    repliesCount: number;
    createdAt: Date;
    userId: { _id: Types.ObjectId; name: string; username: string };
  }[];

  const hasMore = comments.length > limit;
  const page = hasMore ? comments.slice(0, limit) : comments;

  const items: CommentView[] = page.map((c) => ({
    id: String(c._id),
    text: c.text,
    parentId: c.parentId ? String(c.parentId) : null,
    repliesCount: c.repliesCount,
    author: {
      id: String(c.userId._id),
      name: c.userId.name,
      username: c.userId.username,
      avatarUrl: null,
    },
    isOwn: viewerId === String(c.userId._id),
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    items,
    nextCursor: hasMore && page.length > 0 ? String(page[page.length - 1]._id) : null,
  };
}

export async function listReplies(commentId: string, viewerId: string | null) {
  const replies = (await Comment.find({ parentId: commentId, status: "visible" })
    .sort({ createdAt: 1 })
    .limit(50)
    .populate("userId", "name username avatarKey")
    .lean()) as unknown as {
    _id: Types.ObjectId;
    text: string;
    parentId: Types.ObjectId;
    createdAt: Date;
    userId: { _id: Types.ObjectId; name: string; username: string };
  }[];

  return replies.map((c) => ({
    id: String(c._id),
    text: c.text,
    parentId: String(c.parentId),
    repliesCount: 0,
    author: {
      id: String(c.userId._id),
      name: c.userId.name,
      username: c.userId.username,
      avatarUrl: null,
    },
    isOwn: viewerId === String(c.userId._id),
    createdAt: c.createdAt.toISOString(),
  }));
}

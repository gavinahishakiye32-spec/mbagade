import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { getAuthUser } from "@/lib/auth";
import { Post, Business, User } from "@/server/models";
import { loadViewerContext, toPostView } from "@/services/view.service";
import { blockedBy } from "@/services/business.service";
import type { IBusiness, IPost, IUser } from "@/types";
import { FeedItem } from "@/components/feed/feed-item";

interface Props {
  params: Promise<{ id: string }>;
}

async function loadPost(id: string) {
  if (!isValidObjectId(id)) return null;
  const post = await Post.findById(id).lean<IPost | null>();
  if (!post || post.status !== "published") return null;
  const business =
    post.authorType === "business" && post.businessId
      ? await Business.findById(post.businessId).lean<IBusiness | null>()
      : null;
  const user = post.authorType === "user" ? await User.findById(post.authorUserId).lean<IUser | null>() : null;
  if (post.authorType === "business" && !business) return null;
  if (post.authorType === "user" && !user) return null;
  return { post, business, user };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await loadPost(id);
  if (!data) return { title: "Post not found" };
  const authorName = data.post.authorType === "business" ? data.business!.name : data.user!.name;
  return {
    title: `${authorName} on BuyBuy`,
    description: data.post.caption.slice(0, 150),
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const data = await loadPost(id);
  if (!data) notFound();

  const viewer = await getAuthUser();
  const viewerId = viewer ? String(viewer._id) : null;

  if (viewerId) {
    const blocked = await blockedBy(viewerId);
    const targetId =
      data.post.authorType === "business" && data.business ? String(data.business._id) : String(data.post.authorUserId);
    if (blocked.has(targetId)) notFound();
  }

  const ctx = await loadViewerContext(viewerId, [data.post]);
  const view = toPostView(data.post, data.business ?? null, ctx, { user: data.user });

  return (
    <div className="mx-auto max-w-lg">
      <FeedItem post={view} active />
    </div>
  );
}

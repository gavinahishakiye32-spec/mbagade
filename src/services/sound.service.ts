import { Types } from "mongoose";
import { Sound, User, Business } from "@/server/models";
import type { ISound, IUser, IBusiness, SoundView } from "@/types";
import { ApiError } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { storage } from "@/lib/storage";
import { moderateContent } from "@/services/moderation.service";
import { requireAdmin } from "@/lib/auth";

export interface CreateSoundInput {
  title: string;
  artist?: string;
  audioKey: string;
  coverKey?: string;
  durationSec?: number;
  businessId?: string | null;
  official?: boolean;
}

export function toSoundView(sound: ISound, creator: IUser | null, business: IBusiness | null): SoundView {
  let creatorView: SoundView["creator"] = null;
  if (sound.creatorUserId && creator) {
    creatorView = {
      id: String(creator._id),
      name: creator.name,
      username: creator.username,
      avatarUrl: mediaUrl(creator.avatarKey),
    };
  } else if (sound.businessId && business) {
    creatorView = {
      id: String(business._id),
      name: business.name,
      username: business.username,
      avatarUrl: mediaUrl(business.logoKey),
    };
  }
  return {
    id: String(sound._id),
    title: sound.title,
    artist: sound.artist,
    audioUrl: mediaUrl(sound.audioKey) ?? "",
    coverUrl: mediaUrl(sound.coverKey),
    usesCount: sound.usesCount,
    durationSec: sound.durationSec,
    official: sound.official,
    creator: creatorView,
    createdAt: sound.createdAt.toISOString(),
  };
}

export async function createSound(userId: string, input: CreateSoundInput): Promise<ISound> {
  const verdict = await moderateContent(`${input.title} ${input.artist ?? ""}`);
  const official = Boolean(input.official) && verdict.flagged === false;

  const sound = await Sound.create({
    creatorUserId: new Types.ObjectId(userId),
    businessId: input.businessId ? new Types.ObjectId(input.businessId) : null,
    title: input.title,
    artist: input.artist ?? "",
    audioKey: input.audioKey,
    coverKey: input.coverKey ?? null,
    durationSec: input.durationSec ?? 0,
    official,
    status: verdict.flagged ? ("hidden" as const) : ("active" as const),
  });
  return sound;
}

export async function getSound(id: string): Promise<SoundView> {
  const sound = await Sound.findOne({ _id: id, status: "active" }).lean<ISound | null>();
  if (!sound) throw new ApiError("NOT_FOUND", "Sound not found", 404);
  return toSoundView(sound, await loadCreator(sound), await loadBusiness(sound));
}

async function loadCreator(sound: ISound): Promise<IUser | null> {
  if (!sound.creatorUserId) return null;
  return User.findById(sound.creatorUserId).lean<IUser | null>();
}

async function loadBusiness(sound: ISound): Promise<IBusiness | null> {
  if (!sound.businessId) return null;
  return Business.findById(sound.businessId).lean<IBusiness | null>();
}

export interface ListSoundsParams {
  q?: string;
  cursor?: string;
  limit: number;
}

export async function listSounds(params: ListSoundsParams): Promise<{ items: SoundView[]; nextCursor: string | null }> {
  const filter: Record<string, unknown> = { status: "active" };
  if (params.q) {
    filter.$text = { $search: params.q };
  }
  if (params.cursor && /^[a-f0-9]{24}$/i.test(params.cursor)) {
    filter._id = { $lt: new Types.ObjectId(params.cursor) };
  }

  // Search (text) must be sorted by score; otherwise sort by popularity.
  let query = Sound.find(filter) as ReturnType<typeof Sound.find>;
  if (params.q) {
    query = query.sort({ score: { $meta: "textScore" } });
  } else {
    query = query.sort({ usesCount: -1, createdAt: -1 });
  }

  const sounds = (await query.limit(params.limit + 1).lean<ISound[]>()) as unknown;
  const list = sounds as ISound[];
  const hasMore = list.length > params.limit;
  const page = hasMore ? list.slice(0, params.limit) : list;

  const userIds = [...new Set(page.filter((s) => s.creatorUserId).map((s) => String(s.creatorUserId)))];
  const bizIds = [...new Set(page.filter((s) => s.businessId).map((s) => String(s.businessId)))];
  const [users, businesses] = await Promise.all([
    userIds.length ? User.find({ _id: { $in: userIds } }).lean<IUser[]>() : Promise.resolve([] as IUser[]),
    bizIds.length ? Business.find({ _id: { $in: bizIds } }).lean<IBusiness[]>() : Promise.resolve([] as IBusiness[]),
  ]);
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const bizMap = new Map(businesses.map((b) => [String(b._id), b]));

  return {
    items: page.map((s) => toSoundView(s, s.creatorUserId ? userMap.get(String(s.creatorUserId)) ?? null : null, s.businessId ? bizMap.get(String(s.businessId)) ?? null : null)),
    nextCursor: hasMore && page.length > 0 ? String(page[page.length - 1]._id) : null,
  };
}

/** Increments the number of posts that use a sound. Returns false if the sound is unknown/inactive. */
export async function recordSoundUse(soundId: string | null): Promise<boolean> {
  if (!soundId || !/^[a-f0-9]{24}$/i.test(soundId)) return false;
  const res = await Sound.updateOne({ _id: soundId, status: "active" }, { $inc: { usesCount: 1 } });
  return res.modifiedCount > 0;
}

export async function deleteSound(userId: string, soundId: string): Promise<void> {
  const sound = await Sound.findById(soundId);
  if (!sound) throw new ApiError("NOT_FOUND", "Sound not found", 404);
  const isOwner = Boolean(sound.creatorUserId && String(sound.creatorUserId) === userId);
  let isAdmin = false;
  try {
    await requireAdmin();
    isAdmin = true;
  } catch {
    /* not admin */
  }
  if (!isOwner && !isAdmin) throw new ApiError("FORBIDDEN", "You can only delete your own sounds", 403);
  sound.status = "removed";
  await sound.save();
}

/** Removes orphaned audio once a sound/creator is deleted. */
export async function purgeSoundMedia(sound: ISound): Promise<void> {
  for (const key of [sound.audioKey, sound.coverKey]) {
    if (key) await storage().delete(key).catch(() => {});
  }
}

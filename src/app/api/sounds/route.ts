import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createSoundSchema, soundQuerySchema } from "@/lib/validation";
import { createSound, listSounds } from "@/services/sound.service";
import { BusinessMember } from "@/server/models";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/** GET /api/sounds?q=&cursor=&limit= — browse the sound library (public). */
export const GET = handle(async (req: Request) => {
  await connectDB();
  const url = new URL(req.url);
  const params = soundQuerySchema.parse(Object.fromEntries(url.searchParams));
  const result = await listSounds({ q: params.q, cursor: params.cursor, limit: params.limit });
  return ok(result);
});

/** POST /api/sounds — upload/register a new sound (authenticated users). */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const input = await parseJson(req, createSoundSchema);
  await connectDB();

  // Only allow attribution to a business the user manages.
  let businessId: string | null = null;
  if (input.businessId) {
    const member = await BusinessMember.findOne({ userId: user._id, businessId: input.businessId }).lean();
    if (member && ["owner", "manager", "editor"].includes(member.role)) {
      businessId = input.businessId;
    }
  }

  const sound = await createSound(String(user._id), {
    title: input.title,
    artist: input.artist,
    audioKey: input.audioKey,
    coverKey: input.coverKey,
    durationSec: input.durationSec,
    businessId,
    official: input.official,
  });

  const { getSound } = await import("@/services/sound.service");
  const view = await getSound(String(sound._id));
  return ok(view, { status: 201 });
});

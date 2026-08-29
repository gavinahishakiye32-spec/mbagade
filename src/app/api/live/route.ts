import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { liveStartSchema } from "@/lib/validation";
import { startLive, listLive } from "@/services/live.service";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await connectDB();
  const country = new URL(req.url).searchParams.get("country");
  return ok({ items: await listLive(country) });
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const input = await parseJson(req, liveStartSchema);
  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");
  if (!businessId) throw new Error("INVALID_INPUT");
  const { BusinessMember } = await import("@/server/models");
  const membership = await BusinessMember.findOne({ userId: user._id }).lean();
  const id = businessId && /^[a-f0-9]{24}$/i.test(businessId) ? businessId : String(membership?.businessId ?? "");
  if (!id) throw new Error("FORBIDDEN");
  const live = await startLive(String(user._id), id, input.title, input.embedUrl);
  return ok({ id: String(live._id) }, { status: 201 });
});

import { handle, ok, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { adminAdActionSchema } from "@/lib/validation";
import { Advertisement } from "@/server/models";
import { auditLog } from "@/services/admin.service";
import { connectDB } from "@/lib/mongodb";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await connectDB();
  await requireAdmin();
  const ads = await Advertisement.find().sort({ createdAt: -1 }).limit(50).populate("businessId", "name username").lean();
  return ok({
    items: (ads as unknown as {
      _id: { toString(): string };
      type: string;
      title: string;
      status: string;
      budgetCents: number;
      spentCents: number;
      impressions: number;
      impressionsGoal: number;
      clicks: number;
      createdAt: Date;
      businessId: { name: string; username: string };
    }[]).map((a) => ({
      id: a._id.toString(),
      type: a.type,
      title: a.title,
      status: a.status,
      budgetCents: a.budgetCents,
      spentCents: a.spentCents,
      impressions: a.impressions,
      impressionsGoal: a.impressionsGoal,
      clicks: a.clicks,
      businessName: a.businessId?.name ?? "?",
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const admin = await requireAdmin();
  const input = await parseJson(
    req,
    adminAdActionSchema.extend({ advertisementId: z.string().min(1).max(64) })
  );
  const ad = await Advertisement.findById(input.advertisementId);
  if (!ad) throw new Error("NOT_FOUND");
  if (input.action === "approve") ad.status = "active";
  else {
    ad.status = "rejected";
    ad.rejectionNote = input.note ?? null;
  }
  await ad.save();
  await auditLog(String(admin._id), `ad.${input.action}`, "advertisement", String(ad._id));
  return ok({ status: ad.status });
});

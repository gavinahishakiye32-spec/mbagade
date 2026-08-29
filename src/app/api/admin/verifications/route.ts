import { handle, ok, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { verificationReviewSchema } from "@/lib/validation";
import { VerificationRequest } from "@/server/models";
import { reviewVerification } from "@/services/verification.service";
import { auditLog } from "@/services/admin.service";
import { connectDB } from "@/lib/mongodb";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await connectDB();
  await requireAdmin();
  const requests = await VerificationRequest.find({ status: "pending" })
    .sort({ createdAt: 1 })
    .limit(50)
    .populate("businessId", "name username category country city")
    .lean();

  return ok({
    items: (requests as unknown as {
      _id: { toString(): string };
      businessId: { _id: { toString(): string }; name: string; username: string; category: string; country?: string; city?: string };
      registrationNumber: string;
      note: string;
      documents: { type: string; fileKey: string; label: string }[];
      createdAt: Date;
    }[]).map((r) => ({
      id: r._id.toString(),
      business: {
        id: r.businessId._id.toString(),
        name: r.businessId.name,
        username: r.businessId.username,
        category: r.businessId.category,
        location: [r.businessId.city, r.businessId.country].filter(Boolean).join(", "),
      },
      registrationNumber: r.registrationNumber,
      note: r.note,
      documents: r.documents.map((d) => ({ type: d.type, label: d.label, url: `/api/media/${d.fileKey}` })),
      submittedAt: r.createdAt.toISOString(),
    })),
  });
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const admin = await requireAdmin();
  const input = await parseJson(
    req,
    verificationReviewSchema.extend({ requestId: z.string().min(1).max(64) })
  );
  await reviewVerification(String(admin._id), input.requestId, input.decision, input.reviewNote);
  await auditLog(String(admin._id), `verification.${input.decision}`, "verification_request", input.requestId);
  return ok({ reviewed: true });
});

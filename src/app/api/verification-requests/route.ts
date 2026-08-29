import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { verificationSubmitSchema } from "@/lib/validation";
import { submitVerification } from "@/services/verification.service";
import { VerificationRequest, BusinessMember } from "@/server/models";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await connectDB();
  const user = await requireUser();
  const memberships = await BusinessMember.find({ userId: user._id }).select("businessId").lean();
  const requests = await VerificationRequest.find({
    businessId: { $in: memberships.map((m) => m.businessId) },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  return ok({
    items: requests.map((r) => ({
      id: String(r._id),
      businessId: String(r.businessId),
      status: r.status,
      reviewNote: r.reviewNote,
      submittedAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
    })),
  });
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const input = await parseJson(req, verificationSubmitSchema);
  const url = new URL(req.url);
  let businessId = url.searchParams.get("businessId");
  if (!businessId || !/^[a-f0-9]{24}$/i.test(businessId)) {
    const membership = await BusinessMember.findOne({ userId: user._id }).lean();
    if (!membership) throw new Error("FORBIDDEN");
    businessId = String(membership.businessId);
  }
  const request = await submitVerification(String(user._id), businessId, input as never);
  return ok({ id: String(request._id), status: request.status }, { status: 201 });
});

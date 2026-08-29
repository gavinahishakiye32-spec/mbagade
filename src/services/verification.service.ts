import { Types } from "mongoose";
import { VerificationRequest, Business, BusinessMember } from "@/server/models";
import type { IVerificationRequest } from "@/types";
import { ApiError } from "@/lib/api";

export async function submitVerification(
  userId: string,
  businessId: string,
  input: { registrationNumber: string; note: string; documents: { type: string; fileKey: string; label: string }[] }
): Promise<IVerificationRequest> {
  const member = await BusinessMember.findOne({ businessId, userId, role: { $in: ["owner", "manager"] } }).lean();
  if (!member) throw new ApiError("FORBIDDEN", "Only owners/managers can submit verification", 403);

  const business = await Business.findById(businessId).select("verification").lean();
  if (!business) throw new ApiError("NOT_FOUND", "Business not found", 404);
  if (business.verification === "verified") throw new ApiError("ALREADY_VERIFIED", "Business is already verified", 409);
  if (business.verification === "pending") throw new ApiError("ALREADY_PENDING", "A verification request is already under review", 409);

  const request = await VerificationRequest.create({ businessId, submittedByUserId: userId, ...input });
  await Business.updateOne({ _id: businessId }, { verification: "pending" });
  return request.toObject() as IVerificationRequest;
}

export async function reviewVerification(
  adminId: string,
  requestId: string,
  decision: "approved" | "rejected",
  reviewNote: string
): Promise<void> {
  const request = await VerificationRequest.findById(requestId);
  if (!request || request.status !== "pending") throw new ApiError("NOT_FOUND", "Pending request not found", 404);

  request.status = decision;
  request.reviewNote = reviewNote || null;
  request.reviewedByUserId = new Types.ObjectId(adminId);
  request.reviewedAt = new Date();
  await request.save();

  await Business.updateOne(
    { _id: request.businessId },
    {
      verification: decision === "approved" ? "verified" : "rejected",
      ...(decision === "approved" ? { verifiedAt: new Date() } : {}),
    }
  );
}

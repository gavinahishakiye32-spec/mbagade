import { Types } from "mongoose";
import { Report, Post, Comment, Business, User, Product, LiveStream, Advertisement } from "@/server/models";
import type { IReport } from "@/types";
import { ApiError } from "@/lib/api";

export async function createReport(
  reporterId: string,
  input: { targetType: IReport["targetType"]; targetId: string; reason: IReport["reason"]; details: string }
): Promise<IReport> {
  const exists = await Report.findOne({
    reporterId: new Types.ObjectId(reporterId),
    targetType: input.targetType,
    targetId: new Types.ObjectId(input.targetId),
    status: "open",
  }).lean();
  if (exists) throw new ApiError("ALREADY_REPORTED", "You already reported this", 409);

  const report = await Report.create({ reporterId, ...input });

  // Content with repeated reports is auto-hidden pending review
  if (input.targetType === "post") {
    await Post.updateOne({ _id: input.targetId }, { $inc: { reportsCount: 1 } });
    const post = await Post.findById(input.targetId).select("reportsCount").lean();
    if (post && post.reportsCount >= 3) {
      await Post.updateOne({ _id: input.targetId }, { status: "under_review" });
    }
  }
  return report.toObject() as IReport;
}

export async function resolveReport(
  adminId: string,
  reportId: string,
  decision: "actioned" | "dismissed",
  resolution: string,
  note: string
): Promise<void> {
  const report = await Report.findById(reportId);
  if (!report) throw new ApiError("NOT_FOUND", "Report not found", 404);

  if (decision === "actioned") {
    switch (resolution) {
      case "remove_content":
        if (report.targetType === "post") {
          await Post.updateOne({ _id: report.targetId }, { status: "removed" });
        } else if (report.targetType === "comment") {
          await Comment.updateOne({ _id: report.targetId }, { status: "removed" });
        } else if (report.targetType === "product") {
          await Product.updateOne({ _id: report.targetId }, { status: "removed" });
        } else if (report.targetType === "live_stream") {
          await LiveStream.updateOne({ _id: report.targetId }, { status: "ended", endedAt: new Date() });
        } else if (report.targetType === "advertisement") {
          await Advertisement.updateOne({ _id: report.targetId }, { status: "rejected" });
        }
        break;
      case "suspend_account": {
        let userId: Types.ObjectId | null = null;
        if (report.targetType === "user") userId = report.targetId;
        else if (report.targetType === "business") {
          const b = await Business.findById(report.targetId).select("ownerUserId").lean();
          userId = (b?.ownerUserId as Types.ObjectId) ?? null;
        } else if (report.targetType === "post") {
          const p = await Post.findById(report.targetId).select("authorUserId").lean();
          userId = (p?.authorUserId as Types.ObjectId) ?? null;
        } else if (report.targetType === "comment") {
          const c = await Comment.findById(report.targetId).select("userId").lean();
          userId = (c?.userId as Types.ObjectId) ?? null;
        }
        if (userId) await User.updateOne({ _id: userId }, { status: "suspended", suspendedReason: note || "Report resolution" });
        break;
      }
      case "warn":
        // notification-based warning
        break;
      default:
        break;
    }
  }

  report.status = decision;
  report.resolution = `${resolution}${note ? `: ${note}` : ""}`;
  report.resolvedByUserId = new Types.ObjectId(adminId);
  report.resolvedAt = new Date();
  await report.save();
}

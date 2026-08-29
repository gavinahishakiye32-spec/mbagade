import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { adminUserActionSchema } from "@/lib/validation";
import { User, Session } from "@/server/models";
import { auditLog } from "@/services/admin.service";
import { connectDB } from "@/lib/mongodb";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await connectDB();
  await requireAdmin();
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const status = url.searchParams.get("status");

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (q) filter.$or = [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { username: q.toLowerCase() }];

  const users = await User.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  return ok({
    items: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      username: u.username,
      role: u.role,
      status: u.status,
      emailVerified: Boolean(u.emailVerifiedAt),
      foundingCustomer: u.isFoundingCustomer,
      createdAt: u.createdAt.toISOString(),
    })),
  });
});

export const POST = handle(async (req: Request) => {
  await connectDB();
  const admin = await requireAdmin();
  const input = await parseJson(req, adminUserActionSchema.extend({ userId: z.string().min(1).max(64) }));

  const user = await User.findById(input.userId);
  if (!user) throw new ApiError("NOT_FOUND", "User not found", 404);
  if (String(user._id) === String(admin._id)) throw new ApiError("INVALID_INPUT", "You cannot moderate yourself", 422);

  switch (input.action) {
    case "suspend":
      user.status = "suspended";
      user.suspendedReason = input.reason ?? null;
      break;
    case "ban":
      user.status = "banned";
      user.suspendedReason = input.reason ?? null;
      break;
    case "activate":
      user.status = "active";
      user.suspendedReason = null;
      break;
    case "make_admin":
      user.role = "admin";
      break;
    case "remove_admin":
      user.role = "customer";
      break;
    case "grant_founding_customer":
      user.isFoundingCustomer = true;
      user.foundingCustomerAt = new Date();
      break;
    case "revoke_founding_customer":
      user.isFoundingCustomer = false;
      user.foundingCustomerAt = null;
      break;
  }
  await user.save();

  // suspensions/bans revoke sessions immediately
  if (["suspend", "ban"].includes(input.action)) {
    await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
  }

  await auditLog(String(admin._id), `user.${input.action}`, "user", String(user._id), { reason: input.reason ?? "" });
  return ok({ status: user.status, role: user.role });
});

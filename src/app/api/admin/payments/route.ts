import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { Payment, Order, Business, User } from "@/server/models";
import type { IPayment, IOrder } from "@/types";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await connectDB();
  await requireAdmin();
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "payments";

  if (kind === "orders") {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(50).lean<IOrder[]>();
    const businessIds = [...new Set(orders.map((o) => String(o.businessId)))];
    const businesses = await Business.find({ _id: { $in: businessIds } }).select("name").lean();
    const bizMap = new Map(businesses.map((b) => [String(b._id), b.name]));
    return ok({
      items: orders.map((o) => ({
        id: String(o._id),
        reference: o.reference,
        businessName: bizMap.get(String(o.businessId)) ?? "?",
        totalCents: o.totalCents,
        feeCents: o.feeCents,
        currency: o.currency,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  }

  const payments = await Payment.find().sort({ createdAt: -1 }).limit(50).lean<IPayment[]>();
  const userIds = [...new Set(payments.map((p) => String(p.payerUserId)))];
  const users = await User.find({ _id: { $in: userIds } }).select("name email").lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return ok({
    items: payments.map((p) => ({
      id: String(p._id),
      purpose: p.purpose,
      provider: p.provider,
      amountCents: p.amountCents,
      feeCents: p.feeCents,
      currency: p.currency,
      status: p.status,
      description: p.description,
      payer: userMap.get(String(p.payerUserId))?.email ?? "?",
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

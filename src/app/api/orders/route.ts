import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { orderCreateSchema } from "@/lib/validation";
import { createOrder, toOrderView } from "@/services/order.service";
import { Order, Business } from "@/server/models";
import type { IOrder } from "@/types";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/** POST /api/orders — create order + payment session. */
export const POST = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const input = await parseJson(req, orderCreateSchema);
  const origin = new URL(req.url).origin;

  const { order, checkoutUrl, paymentId } = await createOrder(
    String(user._id),
    input.items,
    input.customerContact as never,
    origin
  );

  return ok(
    {
      order: toOrderView(order, { name: "", username: "" }),
      checkoutUrl,
      paymentId,
      // dev provider: client confirms via this endpoint when there is no hosted checkout
      devConfirmUrl: checkoutUrl ? null : `/api/payments/confirm-dev`,
    },
    { status: 201 }
  );
});

/** GET /api/orders — customer's own orders, or ?selling=1&businessId= for sellers. */
export const GET = handle(async (req: Request) => {
  await connectDB();
  const user = await requireUser();
  const url = new URL(req.url);

  if (url.searchParams.get("selling") === "1") {
    const { BusinessMember } = await import("@/server/models/Business");
    const businessId = url.searchParams.get("businessId");
    let query: Record<string, unknown> = {};
    if (businessId && /^[a-f0-9]{24}$/i.test(businessId)) {
      const member = await BusinessMember.exists({ businessId, userId: user._id });
      if (!member && user.role !== "admin") return ok({ orders: [] });
      query = { businessId };
    } else {
      const memberships = await BusinessMember.find({ userId: user._id }).select("businessId").lean();
      query = { businessId: { $in: memberships.map((m) => m.businessId) } };
    }
    const sellerOrders = await Order.find(query).sort({ createdAt: -1 }).limit(100).lean<IOrder[]>();
    const sBizIds = [...new Set(sellerOrders.map((o) => String(o.businessId)))];
    const sBusinesses = await Business.find({ _id: { $in: sBizIds } }).select("name username").lean();
    const sBizMap = new Map(sBusinesses.map((b) => [String(b._id), b]));
    return ok({
      orders: sellerOrders.map((o) =>
        toOrderView(o, sBizMap.get(String(o.businessId)) ?? { name: "Unknown", username: "" }, true)
      ),
    });
  }

  const orders = await Order.find({ customerId: user._id }).sort({ createdAt: -1 }).limit(50).lean<IOrder[]>();
  const businessIds = [...new Set(orders.map((o) => String(o.businessId)))];
  const businesses = await Business.find({ _id: { $in: businessIds } }).select("name username").lean();
  const bizMap = new Map(businesses.map((b) => [String(b._id), b]));

  return ok({
    orders: orders.map((o) =>
      toOrderView(o, bizMap.get(String(o.businessId)) ?? { name: "Unknown", username: "" })
    ),
  });
});

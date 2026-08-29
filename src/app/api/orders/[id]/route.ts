import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { orderStatusSchema } from "@/lib/validation";
import { updateOrderStatus, toOrderView } from "@/services/order.service";
import { Order, Business, BusinessMember } from "@/server/models";
import type { IOrder } from "@/types";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const order = await Order.findById(id).lean<IOrder | null>();
  if (!order) throw new ApiError("NOT_FOUND", "Order not found", 404);

  const isCustomer = String(order.customerId) === String(user._id);
  let isSeller = user.role === "admin";
  if (!isCustomer && !isSeller) {
    isSeller = Boolean(await BusinessMember.exists({ businessId: order.businessId, userId: user._id }));
  }
  if (!isCustomer && !isSeller) throw new ApiError("FORBIDDEN", "Not your order", 403);

  const business = await Business.findById(order.businessId).select("name username").lean();
  return ok({ order: toOrderView(order, business ?? { name: "Unknown", username: "" }, isSeller) });
});

/** PATCH — business updates fulfilment status. */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = await parseJson(req, orderStatusSchema);
  const order = await updateOrderStatus(String(user._id), id, input.status);
  return ok({ status: order.status });
});

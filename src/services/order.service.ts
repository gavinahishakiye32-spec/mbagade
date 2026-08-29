import { Types } from "mongoose";
import { Product, Order, Business, BusinessMember } from "@/server/models";
import type { IOrder } from "@/types";
import { ApiError } from "@/lib/api";
import { PLATFORM_FEE_PERCENT } from "@/config/constants";
import { payments } from "@/services/payment.service";
import { notify } from "@/services/notification.service";

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

function orderReference(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BB-${t}-${r}`;
}

export async function createOrder(
  customerId: string,
  items: OrderItemInput[],
  contact: IOrder["customerContact"],
  origin: string
): Promise<{ order: IOrder; checkoutUrl: string | null; paymentId: string }> {
  if (items.length === 0) throw new ApiError("INVALID_INPUT", "Order requires at least one item", 422);

  const productIds = items.map((i) => new Types.ObjectId(i.productId));
  const products = await Product.find({ _id: { $in: productIds }, status: "active", available: true }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  let businessId: string | null = null;
  let currency: string | null = null;
  let subtotalCents = 0;

  const orderItems = items.map((item) => {
    const p = byId.get(item.productId);
    if (!p) throw new ApiError("INVALID_INPUT", `Product ${item.productId} is unavailable`, 422);
    if (businessId === null) businessId = String(p.businessId);
    else if (businessId !== String(p.businessId))
      throw new ApiError("INVALID_INPUT", "All items in an order must come from the same business", 422);
    if (currency === null) currency = p.currency;
    else if (currency !== p.currency) throw new ApiError("INVALID_INPUT", "Mixed currencies are not supported", 422);
    if (p.stock != null && p.stock < item.quantity)
      throw new ApiError("OUT_OF_STOCK", `${p.name} has only ${p.stock} left`, 422);
    subtotalCents += p.priceCents * item.quantity;
    return { productId: p._id, name: p.name, priceCents: p.priceCents, quantity: item.quantity };
  });

  const feeCents = Math.round((subtotalCents * PLATFORM_FEE_PERCENT) / 100);
  const totalCents = subtotalCents + feeCents;

  const order = await Order.create({
    reference: orderReference(),
    customerId: new Types.ObjectId(customerId),
    businessId,
    items: orderItems,
    subtotalCents,
    feeCents,
    totalCents,
    currency: currency!,
    status: "pending",
    customerContact: contact,
    statusHistory: [{ status: "pending", at: new Date(), byUserId: null }],
  });

  const business = await Business.findById(businessId).select("name").lean();
  const payment = await payments().createPayment({
    purpose: "order",
    payerUserId: customerId,
    businessId,
    orderId: String(order._id),
    amountCents: totalCents,
    currency: currency!,
    description: `Order ${order.reference} — ${business?.name ?? ""}`,
    metadata: { orderReference: order.reference },
    successUrl: `${origin}/orders/${order._id}?paid=1`,
    cancelUrl: `${origin}/orders/${order._id}?cancelled=1`,
  });

  await Order.updateOne({ _id: order._id }, { paymentId: payment.paymentId });

  return {
    order: { ...order.toObject(), paymentId: payment.paymentId as unknown as Types.ObjectId } as IOrder,
    checkoutUrl: payment.checkoutUrl,
    paymentId: payment.paymentId,
  };
}

/** Called when the payment provider confirms funds. Idempotent. */
export async function markOrderPaid(orderId: string): Promise<void> {
  const order = await Order.findById(orderId);
  if (!order || order.status !== "pending") return;

  order.status = "paid";
  order.statusHistory.push({ status: "paid", at: new Date(), byUserId: null });
  await order.save();

  // decrement stock
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.productId, stock: { $ne: null } },
      { $inc: { stock: -item.quantity, ordersCount: item.quantity } }
    );
    await Product.updateOne({ _id: item.productId, stock: null }, { $inc: { ordersCount: item.quantity } });
  }

  const members = await BusinessMember.find({ businessId: order.businessId }).select("userId").lean();
  for (const m of members) {
    await notify({
      userId: m.userId,
      type: "order_new",
      title: `New order ${order.reference}`,
      body: `${order.items.length} item(s) — paid`,
      url: `/dashboard/orders`,
      entityId: order._id,
    });
  }
  await notify({
    userId: order.customerId,
    type: "payment",
    title: "Payment confirmed",
    body: `Your payment for order ${order.reference} was received.`,
    url: `/orders/${order._id}`,
  });
}

export async function updateOrderStatus(actorUserId: string, orderId: string, status: IOrder["status"]): Promise<IOrder> {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError("NOT_FOUND", "Order not found", 404);

  const member = await BusinessMember.exists({ businessId: order.businessId, userId: actorUserId });
  if (!member) throw new ApiError("FORBIDDEN", "You do not manage this business", 403);

  const allowed: Record<string, IOrder["status"][]> = {
    paid: ["processing", "cancelled", "refunded"],
    processing: ["shipped", "cancelled", "refunded"],
    shipped: ["delivered", "refunded"],
    pending: ["cancelled"],
    delivered: ["refunded"],
  };
  if (!allowed[order.status]?.includes(status))
    throw new ApiError("INVALID_STATUS", `Cannot move order from ${order.status} to ${status}`, 422);

  if (status === "refunded") {
    await payments().refundPayment(String(order.paymentId ?? ""));
  }
  if (status === "cancelled" && ["paid", "processing"].includes(order.status)) {
    for (const item of order.items) {
      await Product.updateOne({ _id: item.productId, stock: { $ne: null } }, { $inc: { stock: item.quantity } });
    }
  }

  order.status = status;
  order.statusHistory.push({ status, at: new Date(), byUserId: new Types.ObjectId(actorUserId) });
  await order.save();

  await notify({
    userId: order.customerId,
    type: "order_update",
    title: `Order ${order.reference}: ${status}`,
    body: "The status of your order was updated.",
    url: `/orders/${order._id}`,
    entityId: order._id,
  });
  return order.toObject() as IOrder;
}

export interface OrderView {
  id: string;
  reference: string;
  status: string;
  totalCents: number;
  currency: string;
  itemCount: number;
  businessName: string;
  businessUsername: string;
  createdAt: string;
  customerContact?: IOrder["customerContact"];
  items: { name: string; priceCents: number; quantity: number }[];
}

export function toOrderView(o: IOrder, business: { name: string; username: string }, includeContact = false): OrderView {
  return {
    id: String(o._id),
    reference: o.reference,
    status: o.status,
    totalCents: o.totalCents,
    currency: o.currency,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    businessName: business.name,
    businessUsername: business.username,
    createdAt: o.createdAt.toISOString(),
    ...(includeContact ? { customerContact: o.customerContact } : {}),
    items: o.items.map((i) => ({ name: i.name, priceCents: i.priceCents, quantity: i.quantity })),
  };
}

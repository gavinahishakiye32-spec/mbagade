import mongoose, { Schema } from "mongoose";
import type { IProduct, IOrder, IPayment, ISubscription, IAdvertisement, OrderItem } from "@/types";

const productSchema = new Schema<IProduct>(
  {
    businessId: { type: Schema.Types.ObjectId, required: true, index: true },
    kind: { type: String, enum: ["product", "service"], default: "product" },
    name: { type: String, required: true },
    description: { type: String, default: "", maxlength: 5000 },
    imageKeys: [String],
    videoKey: { type: String, default: null },
    priceCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
    stock: { type: Number, default: null },
    category: { type: String, index: true },
    variants: [{ name: String, options: [String] }],
    available: { type: Boolean, default: true },
    status: { type: String, enum: ["active", "hidden", "removed"], default: "active" },
    viewsCount: { type: Number, default: 0 },
    ordersCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text" });
productSchema.index({ businessId: 1, createdAt: -1 });
productSchema.index({ category: 1, createdAt: -1 });

export const Product = mongoose.models.Product ?? mongoose.model<IProduct>("Product", productSchema);

const orderItemSchema = new Schema<OrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    priceCents: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    reference: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    subtotalCents: { type: Number, required: true },
    feeCents: { type: Number, required: true },
    totalCents: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"], default: "pending", index: true },
    paymentId: { type: Schema.Types.ObjectId, default: null },
    customerContact: {
      name: String,
      phone: String,
      email: String,
      address: String,
      note: String,
    },
    statusHistory: [{ status: String, at: Date, byUserId: Schema.Types.ObjectId }],
  },
  { timestamps: true }
);
orderSchema.index({ businessId: 1, status: 1, createdAt: -1 });
orderSchema.index({ customerId: 1, createdAt: -1 });

export const Order = mongoose.models.Order ?? mongoose.model<IOrder>("Order", orderSchema);

const paymentSchema = new Schema<IPayment>(
  {
    purpose: { type: String, enum: ["order", "advertising", "subscription", "featured"], required: true },
    payerUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, default: null, index: true },
    orderId: { type: Schema.Types.ObjectId, default: null },
    advertisementId: { type: Schema.Types.ObjectId, default: null },
    subscriptionId: { type: Schema.Types.ObjectId, default: null },
    provider: { type: String, required: true },
    providerRef: { type: String, default: null },
    amountCents: { type: Number, required: true },
    feeCents: { type: Number, default: 0 },
    currency: { type: String, required: true },
    status: { type: String, enum: ["pending", "paid", "failed", "refunded", "cancelled"], default: "pending", index: true },
    description: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    refundedCents: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Payment = mongoose.models.Payment ?? mongoose.model<IPayment>("Payment", paymentSchema);

const subscriptionSchema = new Schema<ISubscription>({
  businessId: { type: Schema.Types.ObjectId, required: true, index: true },
  planId: { type: String, required: true },
  status: { type: String, enum: ["active", "cancelled", "expired"], default: "active" },
  startedAt: { type: Date, default: Date.now },
  currentPeriodEnd: { type: Date, required: true },
  paymentId: { type: Schema.Types.ObjectId, default: null },
});

export const Subscription =
  mongoose.models.Subscription ?? mongoose.model<ISubscription>("Subscription", subscriptionSchema);

const advertisementSchema = new Schema<IAdvertisement>(
  {
    businessId: { type: Schema.Types.ObjectId, required: true, index: true },
    postId: { type: Schema.Types.ObjectId, default: null },
    productId: { type: Schema.Types.ObjectId, default: null },
    type: { type: String, enum: ["boost_post", "sponsored_business", "product_promo"], required: true },
    title: { type: String, required: true },
    budgetCents: { type: Number, required: true },
    spentCents: { type: Number, default: 0 },
    impressionsGoal: { type: Number, required: true },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    targeting: {
      countries: [String],
      categories: [String],
    },
    durationDays: { type: Number, required: true },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending_payment", "pending_review", "active", "paused", "completed", "rejected"],
      default: "pending_payment",
      index: true,
    },
    rejectionNote: { type: String, default: null },
    paymentId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);
advertisementSchema.index({ status: 1, endsAt: 1 });

export const Advertisement =
  mongoose.models.Advertisement ?? mongoose.model<IAdvertisement>("Advertisement", advertisementSchema);

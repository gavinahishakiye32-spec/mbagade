import { randomUUID } from "crypto";
import { Payment } from "@/server/models";
import type { IPayment, PaymentPurpose } from "@/types";
import { activePaymentProvider } from "@/lib/env";

/**
 * Payment abstraction layer.
 *
 * Providers are country-agnostic adapters behind one interface:
 *  - stripe: Stripe Checkout (official API; requires STRIPE_SECRET_KEY).
 *            Supports cards + local methods Stripe enables per country.
 *  - dev:    development fallback. Creates a pending payment and exposes a
 *            server-side confirm endpoint so the full order flow is testable
 *            without real credentials. NEVER enabled automatically in production.
 *
 * Adding a provider (e.g. Flutterwave, Paystack, Mobile Money):
 *   implement PaymentProvider and register it in getProvider().
 */

export interface CreatePaymentInput {
  purpose: PaymentPurpose;
  payerUserId: string;
  businessId?: string | null;
  orderId?: string | null;
  advertisementId?: string | null;
  subscriptionId?: string | null;
  amountCents: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

export interface CreatedPayment {
  paymentId: string;
  checkoutUrl: string | null; // null → client should call the dev-confirm endpoint
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment>;
  refundPayment(paymentId: string, amountCents?: number): Promise<void>;
}

/* ---------------- Stripe adapter (lazy-loaded SDK) ---------------- */

class StripeProvider implements PaymentProvider {
  readonly name = "stripe";
  private async sdk() {
    const { default: Stripe } = await import("stripe");
    const { env } = await import("@/lib/env");
    return new Stripe(env.stripeSecretKey!);
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    const stripe = await this.sdk();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountCents,
            product_data: { name: input.description.slice(0, 120) },
          },
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        purpose: input.purpose,
        payerUserId: input.payerUserId,
        ...(input.orderId ? { orderId: input.orderId } : {}),
        ...(input.advertisementId ? { advertisementId: input.advertisementId } : {}),
        ...(input.metadata ?? {}),
      },
    });

    const record = await Payment.create({
      purpose: input.purpose,
      payerUserId: new (await import("mongoose")).Types.ObjectId(input.payerUserId),
      businessId: input.businessId ?? null,
      orderId: input.orderId ?? null,
      advertisementId: input.advertisementId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      provider: this.name,
      providerRef: session.id,
      amountCents: input.amountCents,
      currency: input.currency,
      status: "pending",
      description: input.description,
      metadata: input.metadata ?? {},
    });

    return { paymentId: String(record._id), checkoutUrl: session.url };
  }

  async refundPayment(paymentId: string, amountCents?: number): Promise<void> {
    const stripe = await this.sdk();
    const record = await Payment.findById(paymentId);
    if (!record?.providerRef) throw new Error("Payment has no provider reference");
    const session = await stripe.checkout.sessions.retrieve(record.providerRef);
    if (!session.payment_intent) throw new Error("No payment intent on session");
    await stripe.refunds.create({
      payment_intent: String(session.payment_intent),
      ...(amountCents ? { amount: amountCents } : {}),
    });
    record.status = "refunded";
    record.refundedCents = amountCents ?? record.amountCents;
    await record.save();
  }
}

/* ---------------- Development fallback provider ---------------- */

class DevProvider implements PaymentProvider {
  readonly name = "dev";

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    const record = await Payment.create({
      purpose: input.purpose,
      payerUserId: new (await import("mongoose")).Types.ObjectId(input.payerUserId),
      businessId: input.businessId ?? null,
      orderId: input.orderId ?? null,
      advertisementId: input.advertisementId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      provider: this.name,
      providerRef: `dev_${randomUUID()}`,
      amountCents: input.amountCents,
      currency: input.currency,
      status: "pending",
      description: input.description,
      metadata: input.metadata ?? {},
    });
    // No external checkout — the client calls /api/payments/[id]/confirm-dev
    return { paymentId: String(record._id), checkoutUrl: null };
  }

  async refundPayment(paymentId: string): Promise<void> {
    await Payment.updateOne({ _id: paymentId }, { status: "refunded", refundedCents: 0 });
  }
}

let instance: PaymentProvider | null = null;

export function payments(): PaymentProvider {
  if (!instance) {
    instance = activePaymentProvider() === "stripe" ? new StripeProvider() : new DevProvider();
  }
  return instance;
}

export function toPaymentView(p: IPayment) {
  return {
    id: String(p._id),
    purpose: p.purpose,
    provider: p.provider,
    amountCents: p.amountCents,
    feeCents: p.feeCents,
    currency: p.currency,
    status: p.status,
    description: p.description,
    createdAt: p.createdAt.toISOString(),
  };
}

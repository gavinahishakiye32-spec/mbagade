import { Payment, Order } from "@/server/models";
import { markOrderPaid } from "@/services/order.service";
import { markAdPaid } from "@/services/ad.service";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * POST /api/payments/webhook/stripe — official Stripe webhook receiver.
 * Configure in the Stripe dashboard → Developers → Webhooks with endpoint
 * {APP_URL}/api/payments/webhook/stripe and event:
 *   checkout.session.completed
 * Set STRIPE_WEBHOOK_SECRET to the signing secret Stripe shows you.
 */
export async function POST(req: Request): Promise<Response> {
  if (!env.stripeSecretKey || !env.stripeWebhookSecret) {
    return Response.json({ error: "Stripe webhooks not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  const payload = await req.text();
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(env.stripeSecretKey);
    event = stripe.webhooks.constructEvent(payload, signature, env.stripeWebhookSecret) as unknown as typeof event;
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string; metadata?: Record<string, string> };
    try {
      const payment = await Payment.findOne({ providerRef: session.id });
      if (payment && payment.status === "pending") {
        payment.status = "paid";
        await payment.save();
        if (payment.orderId) await markOrderPaid(String(payment.orderId));
        if (payment.advertisementId) await markAdPaid(String(payment.advertisementId));
      }
      // also handle sessions created before the Payment record existed
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const order = await Order.findById(orderId);
        if (order && order.status === "pending") {
          order.paymentId = payment?._id ?? order.paymentId;
          await order.save();
          await markOrderPaid(orderId);
        }
      }
      const adId = session.metadata?.advertisementId;
      if (adId) await markAdPaid(adId);
    } catch (err) {
      console.error("[stripe-webhook] fulfilment failed", err);
      return Response.json({ error: "Fulfilment error" }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}

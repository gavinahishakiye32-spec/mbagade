import { handle, ok, parseJson, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { Payment } from "@/server/models";
import { markOrderPaid } from "@/services/order.service";
import { markAdPaid } from "@/services/ad.service";
import { activePaymentProvider } from "@/lib/env";
import { connectDB } from "@/lib/mongodb";

/**
 * POST /api/payments/confirm-dev — development-only payment confirmation.
 * Only available when the active provider is the dev fallback. Simulates a
 * successful payment so the full order/ad flow is testable without real
 * payment credentials.
 */
export const POST = handle(async (req: Request) => {
  if (activePaymentProvider() !== "dev") {
    throw new ApiError("NOT_AVAILABLE", "Dev payments are disabled when a real payment provider is configured", 403);
  }
  await connectDB();
  const user = await requireUser();
  const { paymentId } = await parseJson(req, z.object({ paymentId: z.string().min(1).max(64) }));

  const payment = await Payment.findById(paymentId);
  if (!payment) throw new ApiError("NOT_FOUND", "Payment not found", 404);
  if (String(payment.payerUserId) !== String(user._id)) throw new ApiError("FORBIDDEN", "Not your payment", 403);
  if (payment.status === "paid") return ok({ alreadyPaid: true });

  payment.status = "paid";
  await payment.save();

  // fulfil purpose
  if (payment.orderId) await markOrderPaid(String(payment.orderId));
  if (payment.advertisementId) await markAdPaid(String(payment.advertisementId));

  return ok({ paid: true });
});

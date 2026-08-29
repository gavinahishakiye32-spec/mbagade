"use client";

import { use } from "react";
import { useApi } from "@/components/api-client";
import { Badge, LoadingBlock, ErrorState } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

interface OrderDetail {
  order: {
    id: string;
    reference: string;
    status: string;
    items: { name: string; quantity: number; priceCents: number }[];
    totalCents: number;
    currency: string;
    createdAt: string;
    businessName: string;
    businessUsername: string;
  };
}

const STEPS = ["pending", "paid", "processing", "shipped", "delivered"];

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const state = useApi<OrderDetail>(`/api/orders/${id}`);

  if (state.loading) return <LoadingBlock />;
  if (state.error || !state.data) return <ErrorState message={state.error ?? "Order not found"} />;

  const order = state.data.order;
  const stepIndex = STEPS.indexOf(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted">{order.reference}</span>
          <Badge tone={order.status === "cancelled" ? "danger" : stepIndex >= 4 ? "success" : "primary"}>{order.status}</Badge>
        </div>

        {/* progress */}
        {stepIndex >= 0 && (
          <div className="mt-4 flex items-center">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i <= stepIndex ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"
                  }`}
                >
                  {i < stepIndex ? "✓" : i + 1}
                </div>
                {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < stepIndex ? "bg-primary" : "bg-surface-2"}`} />}
              </div>
            ))}
          </div>
        )}
        {stepIndex >= 0 && (
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-muted">
            {STEPS.map((s) => <span key={s}>{s}</span>)}
          </div>
        )}

        <div className="mt-5 space-y-3 border-t border-border pt-4">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.name} × {item.quantity}</span>
              <span>${((item.priceCents * item.quantity) / 100).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-3 font-bold">
            <span>Total</span>
            <span>${(order.totalCents / 100).toFixed(2)} {order.currency}</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">
          Sold by <a href={`/b/${order.businessUsername}`} className="text-primary hover:underline">{order.businessName}</a> · Placed {timeAgo(order.createdAt)}
        </p>
      </div>
    </div>
  );
}

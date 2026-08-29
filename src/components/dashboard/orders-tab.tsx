"use client";

import { useState } from "react";
import { useApi, apiFetch } from "@/components/api-client";
import { Badge, Button, EmptyState, ErrorState, LoadingBlock, toast } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

interface OrderRow {
  id: string;
  reference: string;
  status: string;
  totalCents: number;
  currency: string;
  itemCount: number;
  businessName: string;
  createdAt: string;
  customerContact?: { name?: string; email?: string; phone?: string };
}

const NEXT_STATUS: Record<string, string[]> = {
  pending: ["cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export function OrdersTab({ businessId }: { businessId: string }) {
  // seller view: reuse /api/orders?selling=1
  const state = useApi<{ orders: OrderRow[] }>(`/api/orders?selling=1&businessId=${businessId}`);
  const [busy, setBusy] = useState<string | null>(null);

  const setStatus = async (orderId: string, status: string) => {
    setBusy(orderId);
    try {
      await apiFetch(`/api/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      state.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  if (state.loading && !state.data) return <LoadingBlock />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  const orders = state.data?.orders ?? [];

  if (orders.length === 0) {
    return <EmptyState title="No orders yet" hint="Orders from your product pages will appear here." />;
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {orders.map((o) => (
        <li key={o.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">{o.reference}</span>
            <Badge tone={o.status === "pending" ? "warning" : o.status === "delivered" ? "success" : o.status === "cancelled" || o.status === "refunded" ? "danger" : "primary"}>
              {o.status}
            </Badge>
            <span className="ml-auto font-bold">${(o.totalCents / 100).toFixed(2)} {o.currency}</span>
          </div>
          <p className="mt-1 text-sm">
            {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {timeAgo(o.createdAt)}
            {o.customerContact?.name ? ` · ${o.customerContact.name}` : ""}
            {o.customerContact?.phone ? ` · ${o.customerContact.phone}` : ""}
          </p>
          {NEXT_STATUS[o.status]?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {NEXT_STATUS[o.status].map((s) => (
                <Button key={s} size="sm" variant={s === "refunded" || s === "cancelled" ? "outline" : "primary"} loading={busy === o.id} onClick={() => setStatus(o.id, s)}>
                  Mark {s}
                </Button>
              ))}
            </div>
          )}
        </li>
      )      )}
    </ul>
  );
}

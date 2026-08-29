"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useApi } from "@/components/api-client";
import { Badge, EmptyState, LinkButton, LoadingBlock } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

interface OrderItem {
  id: string;
  reference: string;
  status: string;
  totalCents: number;
  currency: string;
  itemCount: number;
  businessName: string;
  createdAt: string;
}

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger" | "primary"> = {
  pending: "warning",
  paid: "primary",
  processing: "primary",
  shipped: "primary",
  delivered: "success",
  completed: "success",
  cancelled: "default",
  refunded: "danger",
};

export default function OrdersPage() {
  const state = useApi<{ orders: OrderItem[] }>("/api/orders");

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <h1 className="mb-4 text-lg font-bold">My orders</h1>
      {state.loading ? (
        <LoadingBlock />
      ) : state.error ? (
        <EmptyState title="Could not load orders" hint={state.error} />
      ) : !state.data || state.data.orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={36} />}
          title="No orders yet"
          hint="Products you buy from businesses will appear here with full tracking."
          action={<LinkButton href="/discover" size="sm" className="mt-2">Discover products</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {state.data.orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted">{o.reference}</span>
                <Badge tone={STATUS_TONE[o.status] ?? "default"}>{o.status}</Badge>
              </div>
              <p className="mt-1.5 font-semibold">{o.businessName}</p>
              <div className="mt-0.5 flex justify-between text-sm text-muted">
                <span>{o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {timeAgo(o.createdAt)}</span>
                <strong className="text-text">${(o.totalCents / 100).toFixed(2)} {o.currency}</strong>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

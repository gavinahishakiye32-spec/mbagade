"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { Button, Input, Label, Modal, toast } from "@/components/ui";
import { apiFetch } from "@/components/api-client";
import { useSession } from "@/components/session-context";

export function BuyPanel({
  productId,
  name,
  priceCents,
  currency,
  inStock,
}: {
  productId: string;
  name: string;
  priceCents: number;
  currency: string;
  inStock: boolean;
}) {
  const router = useRouter();
  const { user } = useSession();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const openCheckout = () => {
    if (!user) {
      toast("Log in to purchase", "error");
      router.push(`/login?next=/products/${productId}`);
      return;
    }
    setContactName(user.name);
    setCheckoutOpen(true);
  };

  const placeOrder = async () => {
    if (contactName.trim().length < 2) {
      toast("Enter your full name", "error");
      return;
    }
    setLoading(true);
    try {
      const d = await apiFetch<{ order: { id: string }; checkoutUrl: string | null; paymentId: string | null }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items: [{ productId, quantity }],
          customerContact: {
            name: contactName.trim(),
            phone: phone.trim() || undefined,
            address: address.trim() || undefined,
          },
        }),
      });
      if (d.checkoutUrl) {
        window.location.href = d.checkoutUrl;
        return;
      }
      // dev provider — confirm immediately then show the order
      if (d.paymentId) {
        await apiFetch("/api/payments/confirm-dev", { method: "POST", body: JSON.stringify({ paymentId: d.paymentId }) }).catch(() => {});
      }
      router.push(`/orders/${d.order.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setLoading(false);
    }
  };

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Qty</span>
        <div className="flex items-center rounded-xl border border-border">
          <button className="px-3 py-1.5 text-lg" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease">−</button>
          <span className="w-8 text-center font-semibold">{quantity}</span>
          <button className="px-3 py-1.5 text-lg" onClick={() => setQuantity((q) => q + 1)} aria-label="Increase">+</button>
        </div>
        <span className="ml-auto text-sm text-muted">
          Total: <strong className="text-text">${((priceCents * quantity) / 100).toFixed(2)} {currency}</strong>
        </span>
      </div>

      <Button size="lg" className="w-full" disabled={!inStock} onClick={openCheckout}>
        <ShoppingCart size={18} />
        {inStock ? "Buy now" : "Out of stock"}
      </Button>
      <p className="text-center text-xs text-muted">
        Secure checkout · Buyer protection · Direct support chat with the seller
      </p>

      <Modal open={checkoutOpen} onClose={() => !loading && setCheckoutOpen(false)} title={`Checkout — ${name}`}>
        <div className="space-y-4">
          <div className="flex justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm">
            <span>{name} × {quantity}</span>
            <strong>${((priceCents * quantity) / 100).toFixed(2)} {currency}</strong>
          </div>
          <div>
            <Label htmlFor="co-name">Full name *</Label>
            <Input id="co-name" value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label htmlFor="co-phone">Phone / WhatsApp</Label>
            <Input id="co-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234…" maxLength={30} />
          </div>
          <div>
            <Label htmlFor="co-addr">Delivery address</Label>
            <Input id="co-addr" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
          </div>
          <Button size="lg" className="w-full" loading={loading} onClick={placeOrder}>
            Place order
          </Button>
        </div>
      </Modal>
    </div>
  );
}

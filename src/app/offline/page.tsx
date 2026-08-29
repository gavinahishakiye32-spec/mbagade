import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-5xl">📡</span>
      <h1 className="text-xl font-bold">You&apos;re offline</h1>
      <p className="max-w-xs text-sm text-muted">
        BuyBuy needs a connection to show fresh content. Check your network and try again.
      </p>
      <Link href="/" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary">
        Retry
      </Link>
    </div>
  );
}

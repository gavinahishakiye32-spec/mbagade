"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA install prompt. In-app "Add to Home Screen" for Android/Chrome
 * (beforeinstallprompt) with a graceful hint fallback for iOS Safari where
 * the standard event never fires. Auto-hides once the app is installed.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [shown, setShown] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Show on load (respecting prior dismissal) — needed for iOS which has
    // no beforeinstallprompt event.
    const t = setTimeout(() => {
      if (localStorage.getItem("bb-install-dismissed") === "1") setDismissed(true);
      else setShown(true);
    }, 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, []);

  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (installed || dismissed || !shown) return null;
  if (!deferred && !isIOS) return null;

  const handleInstall = async () => {
    if (!deferred) {
      setShowIosHelp(true);
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("bb-install-dismissed", "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Download size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Install BuyBuy</p>
            <p className="text-xs text-muted">
              {deferred ? "Add to your home screen for quick access." : "Get quick access from your home screen."}
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="rounded p-1 text-muted hover:bg-surface hover:text-text"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
      {showIosHelp && (
        <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-muted">
          In Safari, tap the <strong>Share</strong> button, then choose{" "}
          <strong>Add to Home Screen</strong>.
        </p>
      )}
      <Button size="sm" className="mt-2 w-full" onClick={handleInstall}>
        <Download size={15} /> {deferred ? "Install" : "How to install"}
      </Button>
    </div>
  );
}

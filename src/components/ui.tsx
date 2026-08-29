"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect } from "react";

/* ---------- Button ---------- */

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        size === "icon" && "h-10 w-10",
        variant === "primary" && "bg-primary text-on-primary hover:bg-primary-strong",
        variant === "secondary" && "bg-surface-2 text-text hover:bg-border",
        variant === "ghost" && "text-muted hover:text-text hover:bg-surface-2",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        variant === "outline" && "border border-border text-text hover:bg-surface-2",
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        variant === "primary" && "bg-primary text-on-primary hover:bg-primary-strong",
        variant === "secondary" && "bg-surface-2 text-text hover:bg-border",
        variant === "ghost" && "text-muted hover:text-text hover:bg-surface-2",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        variant === "outline" && "border border-border text-text hover:bg-surface-2",
        className
      )}
    >
      {children}
    </Link>
  );
}

/* ---------- Inputs ---------- */

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none resize-none",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-1.5 text-left"
    >
      <span className="text-sm">{label}</span>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[24px]" : "translate-x-[3px]"}`}
        />
      </span>
    </button>
  );
}

/* ---------- Feedback ---------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className ?? "h-5 w-5")} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger text-xl">!</div>
      <p className="text-sm text-muted max-w-xs">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 px-6 text-center">
      {icon && <div className="mb-1 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-sm text-muted max-w-xs">{hint}</p>}
      {action}
    </div>
  );
}

/* ---------- Avatar / Badge ---------- */

export function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex items-center justify-center rounded-full bg-primary/20 text-primary font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </div>
  );
}

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "warning" | "danger" | "primary" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "default" && "bg-surface-2 text-muted",
        tone === "success" && "bg-success/15 text-success",
        tone === "warning" && "bg-accent/15 text-accent",
        tone === "danger" && "bg-danger/15 text-danger",
        tone === "primary" && "bg-primary/15 text-primary"
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close dialog" className="absolute inset-0" style={{ background: "var(--overlay)" }} onClick={onClose} />
      <div
        className={cn(
          "relative w-full rounded-t-2xl sm:rounded-2xl bg-surface border border-border shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto",
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-3.5">
          <h2 className="font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Toast (minimal) ---------- */

let toastListener: ((msg: string, tone: "info" | "error") => void) | null = null;

export function toast(msg: string, tone: "info" | "error" = "info") {
  toastListener?.(msg, tone);
}

export function ToastHost() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    toastListener = (msg, tone) => {
      const el = document.getElementById("bb-toast");
      if (!el) return;
      el.textContent = msg;
      el.className = `fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm shadow-lg animate-fade-up ${
        tone === "error" ? "bg-danger text-white" : "bg-surface-2 text-text border border-border"
      }`;
      clearTimeout(timer);
      timer = setTimeout(() => {
        el.className = "hidden";
      }, 3000);
    };
    return () => {
      toastListener = null;
    };
  }, []);
  return <div id="bb-toast" className="hidden" role="status" />;
}

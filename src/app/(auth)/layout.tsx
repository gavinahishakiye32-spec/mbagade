import Link from "next/link";
import { SITE } from "@/config/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary text-lg">B</span>
        {SITE.name}
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl">{children}</div>
      <p className="mt-6 max-w-xs text-center text-xs text-muted">
        The global social platform where businesses grow through authentic video, community and commerce.
      </p>
    </div>
  );
}

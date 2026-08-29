"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/components/api-client";
import { Button, LoadingBlock } from "@/components/ui";

function VerifyInner() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Missing verification token.");
      return;
    }
    apiFetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setState("ok"))
      .catch((e: Error) => {
        setState("error");
        setMessage(e.message);
      });
  }, [token]);

  return (
    <div className="text-center">
      {state === "pending" && <LoadingBlock label="Verifying your email…" />}
      {state === "ok" && (
        <>
          <p className="mb-4 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">Email verified! Your account is fully active.</p>
          <Link href="/"><Button className="w-full">Start exploring</Button></Link>
        </>
      )}
      {state === "error" && (
        <>
          <p className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{message}</p>
          <Link href="/login" className="text-sm font-semibold text-primary hover:underline">Back to login</Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <VerifyInner />
    </Suspense>
  );
}

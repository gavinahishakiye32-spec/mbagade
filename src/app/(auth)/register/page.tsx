import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { LoadingBlock } from "@/components/ui";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <AuthForm mode="register" />
    </Suspense>
  );
}

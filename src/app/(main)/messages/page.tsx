import { Suspense } from "react";
import type { Metadata } from "next";
import { MessagesScreen } from "@/components/messages/messages-screen";
import { LoadingBlock } from "@/components/ui";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <MessagesScreen />
    </Suspense>
  );
}

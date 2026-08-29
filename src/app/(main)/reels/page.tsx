import type { Metadata } from "next";
import { ReelsScreen } from "@/components/feed/reels-screen";

export const metadata: Metadata = {
  title: "Reels",
};

export default function ReelsPage() {
  return <ReelsScreen />;
}

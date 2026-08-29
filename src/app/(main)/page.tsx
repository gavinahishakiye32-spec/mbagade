import type { Metadata } from "next";
import { FeedScreen } from "@/components/feed/feed-screen";

export const metadata: Metadata = {
  title: "Home",
};

export default function HomePage() {
  return <FeedScreen />;
}

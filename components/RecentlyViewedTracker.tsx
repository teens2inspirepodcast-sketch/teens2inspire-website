"use client";
import { useEffect } from "react";

export function RecentlyViewedTracker({ contentId }: { contentId: string }) {
  useEffect(() => { void fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentId }) }).catch(() => undefined); }, [contentId]);
  return null;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MembershipTier } from "@/lib/membership";

export function MembershipSuccessStatus({ tier, active }: { tier: MembershipTier; active: boolean }) {
  const [isActive, setIsActive] = useState(active);
  const router = useRouter();
  useEffect(() => {
    if (isActive) return;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const response = await fetch("/api/membership/status", { cache: "no-store" });
        const result = await response.json();
        if (response.ok && result.status === "active") {
          setIsActive(true); window.clearInterval(timer); router.refresh();
        }
      } catch { /* Keep the processing message visible and try again shortly. */ }
      if (attempts >= 12) window.clearInterval(timer);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [isActive, router]);

  if (!isActive) return <div className="membership-success-pending" role="status"><span className="membership-confirmation-mark" aria-hidden="true">✳</span><span className="eyebrow">Almost there</span><h1>We’re confirming your membership.</h1><p>Your payment is being confirmed securely. This page will update as soon as your membership is active.</p><Link className="button button-outline" href="/profile">View my profile <span aria-hidden="true">↗</span></Link></div>;

  return <div className="membership-success-active">
    <span className="membership-confirmation-mark" aria-hidden="true">✳</span><span className="eyebrow">Your space is ready</span>
    <h1>Welcome to<br /><em>Teens2Inspire.</em></h1>
    <p>Your {tier} membership is active. Listen. Watch. Explore. Connect. Grow.</p>
    <div className="membership-welcome-links" aria-label="Explore Teens2Inspire">
      <Link href="/listen"><span aria-hidden="true">✳</span><strong>Listen</strong><small>Podcasts &amp; conversations</small></Link>
      <Link href="/watch"><span aria-hidden="true">▶</span><strong>Watch</strong><small>Stories &amp; videos</small></Link>
      <Link href="/resources"><span aria-hidden="true">✦</span><strong>Explore</strong><small>Resources &amp; ideas</small></Link>
      <Link href="/events"><span aria-hidden="true">◇</span><strong>Connect</strong><small>Events &amp; community</small></Link>
    </div>
    <div className="membership-success-actions"><Link className="button button-primary" href="/listen">Start exploring <span aria-hidden="true">↗</span></Link><Link className="button button-outline" href="/profile">View my profile <span aria-hidden="true">→</span></Link></div>
  </div>;
}

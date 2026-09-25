"use client";

import { useState } from "react";

export function MembershipActionButton({ action, tier }: { action: "checkout" | "portal"; tier?: "personal" | "family" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isCheckout = action === "checkout";
  async function go() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/stripe/${isCheckout ? "checkout" : "portal"}`, { method: "POST", ...(isCheckout && tier ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier }) } : {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t continue. Please try again.");
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t continue. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="membership-action-wrap"><button className="button button-primary" type="button" onClick={go} disabled={busy}>{busy ? "One moment…" : isCheckout ? `Choose ${tier === "family" ? "Family" : "Personal"} plan` : "Manage billing"}<span aria-hidden="true">↗</span></button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}

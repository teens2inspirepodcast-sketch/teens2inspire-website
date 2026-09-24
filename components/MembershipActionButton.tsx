"use client";

import { useState } from "react";

export function MembershipActionButton({ action }: { action: "checkout" | "portal" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isCheckout = action === "checkout";
  async function go() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/stripe/${isCheckout ? "checkout" : "portal"}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t continue. Please try again.");
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t continue. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="membership-action-wrap"><button className="button button-primary" type="button" onClick={go} disabled={busy}>{busy ? "One moment…" : isCheckout ? "Continue to secure checkout" : "Manage billing"}<span aria-hidden="true">↗</span></button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SchoolCodeForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/membership/redeem-school-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t apply that code. Please try again.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t apply that code. Please try again.");
    } finally { setBusy(false); }
  }
  return <form className="membership-code-form" onSubmit={submit}>
    <label className="membership-field">School code<input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" required /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-primary" disabled={busy || !code.trim()}>{busy ? "Checking…" : "Apply school code"}<span aria-hidden="true">↗</span></button>
  </form>;
}

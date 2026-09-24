"use client";

import { FormEvent, useState } from "react";

export function SchoolCodeManager() {
  const [schoolName, setSchoolName] = useState("");
  const [maxUses, setMaxUses] = useState("25");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setCode(""); setBusy(true);
    try {
      const response = await fetch("/api/admin/school-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schoolName, maxUses, expiresInDays }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t create the school code.");
      setCode(result.code); setNotice(`Created a code for ${result.schoolName}. Save it now; the full code won’t be shown again.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t create the school code.");
    } finally { setBusy(false); }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(code); setNotice("School code copied. Save it somewhere secure and share it only with that school."); }
    catch { setNotice("Select and copy the code, then share it only with that school."); }
  }

  return <section className="studio-editor school-code-editor">
    <span className="eyebrow">Community access</span><h2>Create a school code</h2><p>Codes are stored as one-way hashes and can be used only the number of times you set.</p>
    <form className="studio-form" onSubmit={submit}>
      <div className="form-grid">
        <label>School name<input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} maxLength={120} required /></label>
        <label>Number of uses<input type="number" min={1} max={10000} value={maxUses} onChange={(event) => setMaxUses(event.target.value)} required /></label>
        <label className="form-wide">Expires after days <span className="label-hint">Optional · leave blank if it should not expire</span><input type="number" min={1} max={3650} value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} placeholder="No expiry" /></label>
      </div>
      <button className="button button-primary" disabled={busy}>{busy ? "Creating…" : "Create school code"}<span aria-hidden="true">↗</span></button>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {code && <div className="school-code-created"><div><small>New school code</small><output>{code}</output></div><button className="button button-outline" type="button" onClick={copyCode}>Copy code</button></div>}
    {notice && <p className="form-success" role="status">{notice}</p>}
  </section>;
}

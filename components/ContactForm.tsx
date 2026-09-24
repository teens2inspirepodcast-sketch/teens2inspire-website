"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try { const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }); if (!response.ok) throw new Error(); form.reset(); setMessage("Thanks for reaching out. Your note is on its way."); }
    catch { setMessage("We couldn't send that just now. Please try again in a little bit."); }
    finally { setBusy(false); }
  }
  return <form className="stack-form" onSubmit={submit}>
    <label>Your name<input name="name" autoComplete="name" required maxLength={100} /></label>
    <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    <label>Subject<input name="subject" required maxLength={150} /></label>
    <label>Your message<textarea name="message" rows={5} required maxLength={5000} /></label>
    {message && <p className="form-success" role="status">{message}</p>}
    <button className="button button-primary" disabled={busy}>{busy ? "Sending…" : "Send your message"}<span aria-hidden="true">↗</span></button>
  </form>;
}

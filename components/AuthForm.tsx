"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess(""); setBusy(true);
    try {
      const form = new FormData(event.currentTarget); const supabase = createClient();
      const email = String(form.get("email")); const password = String(form.get("password"));
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password }); if (authError) throw authError;
      } else {
        const firstName = String(form.get("firstName"));
        const interests = String(form.get("interests") || "").split(",").map((x) => x.trim()).filter(Boolean);
        const redirectTo = `${window.location.origin}/auth/callback?next=%2Fprofile`;
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { first_name: firstName, interests }, emailRedirectTo: redirectTo } }); if (authError) throw authError;
        if (!data.session) { setSuccess("Check your inbox for a confirmation link, then come back to sign in."); return; }
      }
      router.push("/auth/callback?next=%2Fprofile"); router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setError(message.toLowerCase().includes("invalid login credentials")
        ? "We couldn’t sign you in. Check your email and password, or reset your password."
        : message || "We couldn’t complete that. Please try again.");
    }
    finally { setBusy(false); }
  }
  return <form className="stack-form" onSubmit={submit}>
    {mode === "signup" && <label>First name<input name="firstName" autoComplete="given-name" required /></label>}
    <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
    <label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></label>
    {mode === "signup" && <label>What are you into? <span className="label-hint">Optional · separate with commas</span><input name="interests" placeholder="Friendship, Jewish life, school..." /></label>}
    {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}
    <button className="button button-primary" disabled={busy}>{busy ? "One moment…" : mode === "login" ? "Sign in" : "Create your account"}<span aria-hidden="true">↗</span></button>
    {mode === "signup" && <p className="privacy-note">Your account is a private space for your saved content and interests.</p>}
  </form>;
}

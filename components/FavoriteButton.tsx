"use client";

import Link from "next/link";
import { useState } from "react";

export function FavoriteButton({ contentId, initialSaved = false }: { contentId: string; initialSaved?: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setNotice(""); setBusy(true);
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentId }) });
      if (response.status === 401) { setNotice("Sign in to save this for later."); return; }
      if (!response.ok) { setNotice("We couldn't update your saved items. Please try again."); return; }
      const body = await response.json(); setSaved(body.saved);
    } catch { setNotice("We couldn't update your saved items. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="favorite-wrap"><button className={`button button-outline favorite-button${saved ? " is-saved" : ""}`} onClick={toggle} aria-pressed={saved} disabled={busy}>{busy ? "Saving…" : saved ? "♥ Saved" : "♡ Save for later"}</button>{notice && <p className="inline-notice">{notice} {notice.startsWith("Sign in") && <Link href="/login">Sign in</Link>}</p>}</div>;
}

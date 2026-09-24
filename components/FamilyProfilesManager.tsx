"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type FamilyProfile = { id: string; first_name: string; display_name: string; interests: string[] };

export function FamilyProfilesManager({ profiles }: { profiles: FamilyProfile[] }) {
  const [firstName, setFirstName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function addProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/profile/family", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName, displayName }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t add that profile. Please try again.");
      setFirstName(""); setDisplayName(""); router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t add that profile. Please try again.");
    } finally { setBusy(false); }
  }

  async function removeProfile(id: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/profile/family", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t remove that profile. Please try again.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t remove that profile. Please try again.");
    } finally { setBusy(false); }
  }

  const used = 1 + profiles.length;
  return <section className="profile-section family-profile-section">
    <div className="section-heading"><div><span className="eyebrow">Family membership</span><h2>Your three profiles</h2></div><span className="family-profile-count">{used} of 3</span></div>
    <p className="family-profile-note">Your profile is included. Add up to two more first names and display names for your family. These details stay private to this account.</p>
    <div className="family-profile-list">
      {profiles.map((profile) => <article className="family-profile-card" key={profile.id}><span className="family-profile-avatar" aria-hidden="true">{profile.display_name.slice(0,1).toUpperCase()}</span><div><strong>{profile.display_name}</strong><small>{profile.first_name}</small></div><button type="button" className="family-profile-remove" onClick={() => removeProfile(profile.id)} disabled={busy} aria-label={`Remove ${profile.display_name} profile`}>Remove</button></article>)}
      {profiles.length === 0 && <div className="family-profile-empty"><strong>Your family space has room for two more profiles.</strong><p>Add another profile whenever you’re ready.</p></div>}
    </div>
    {used < 3 && <form className="family-profile-form" onSubmit={addProfile}>
      <label className="membership-field">First name<input value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={60} required /></label>
      <label className="membership-field">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} required /></label>
      <button className="button button-outline" disabled={busy}>{busy ? "Saving…" : "Add a profile"}<span aria-hidden="true">＋</span></button>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}

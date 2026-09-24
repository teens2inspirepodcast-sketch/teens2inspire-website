"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { membershipInterests, passwordRequirements } from "@/lib/membership";

export function ProfileSettingsForm({ userId, email, firstName: initialFirstName, displayName: initialDisplayName, interests: initialInterests, avatarUrl: initialAvatarUrl }: {
  userId: string; email: string; firstName: string; displayName: string; interests: string[]; avatarUrl: string;
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [interests, setInterests] = useState(initialInterests);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const objectUrl = URL.createObjectURL(photo);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);

  function toggleInterest(value: string) {
    setInterests((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (!firstName.trim() || firstName.trim().length > 60 || !displayName.trim() || displayName.trim().length > 40) {
      setError("Enter a first name and a display name under 40 characters."); return;
    }
    if (password || confirmPassword) {
      const requirements = passwordRequirements(password);
      if (!requirements.length || !requirements.number || !requirements.uppercase) { setError("Use at least 8 characters, one number, and one uppercase letter for your password."); return; }
      if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    }
    if (photo && (!/^image\/(jpeg|png|webp)$/.test(photo.type) || photo.size > 5 * 1024 * 1024)) {
      setError("Choose a JPG, PNG or WebP image up to 5 MB."); return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      let avatarPath: string | undefined;
      if (photo) {
        const extension = photo.type === "image/jpeg" ? "jpg" : photo.type === "image/png" ? "png" : "webp";
        avatarPath = `${userId}/profile-photo.${extension}`;
        const { error: uploadError } = await supabase.storage.from("profile-photos").upload(avatarPath, photo, { upsert: true, contentType: photo.type, cacheControl: "3600" });
        if (uploadError) throw new Error("We couldn’t upload that photo. Try another image or add it later.");
      }
      const response = await fetch("/api/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, displayName, interests, ...(avatarPath ? { avatarPath } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t save your profile.");
      if (password) {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) throw new Error("Your profile was saved, but your password could not be changed. Please try again.");
      }
      setPassword(""); setConfirmPassword(""); setPhoto(null); setNotice("Your profile is up to date."); router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t save your profile. Please try again.");
    } finally { setBusy(false); }
  }

  return <form className="profile-settings-form" onSubmit={submit}>
    <div className="profile-settings-top">
      <div className="profile-photo-control">
        {preview || initialAvatarUrl ? <Image src={preview || initialAvatarUrl} unoptimized width={88} height={88} alt="Your profile photo" /> : <span aria-hidden="true">{displayName.trim().slice(0,1).toUpperCase() || "✦"}</span>}
        <label className="photo-upload-label">{photo ? "Change photo" : "Add a photo"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} aria-label="Choose a profile photo" /></label>
        <small>JPG, PNG or WebP · up to 5 MB</small>
      </div>
      <div className="profile-email-block"><span className="eyebrow">Your private sign-in</span><strong>{email}</strong><small>Your email is only visible to you.</small></div>
    </div>
    <div className="profile-settings-grid">
      <label className="membership-field">First name<input value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={60} autoComplete="given-name" /></label>
      <label className="membership-field">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} autoComplete="nickname" /></label>
    </div>
    <fieldset className="interest-fieldset"><legend>Your interests</legend><div className="interest-chip-list">{membershipInterests.map((interest) => <button type="button" key={interest} className={`interest-chip${interests.includes(interest) ? " is-selected" : ""}`} aria-pressed={interests.includes(interest)} onClick={() => toggleInterest(interest)}>{interest}</button>)}</div></fieldset>
    <details className="profile-password-details"><summary>Change password</summary><div className="profile-settings-grid"><label className="membership-field">New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="membership-field">Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label></div><p className="field-help">At least 8 characters, one number, and one uppercase letter.</p></details>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}<span aria-hidden="true">↗</span></button>
  </form>;
}

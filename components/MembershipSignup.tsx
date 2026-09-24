"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { membershipInterests, membershipOptions, passwordRequirements, type MembershipTier } from "@/lib/membership";

type SignupValues = {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  displayName: string;
  tier: MembershipTier;
  schoolCode: string;
  interests: string[];
  acceptedTerms: boolean;
};

const initialValues: SignupValues = {
  email: "", password: "", confirmPassword: "", firstName: "", displayName: "",
  tier: "personal", schoolCode: "", interests: [], acceptedTerms: false,
};
const stepNames = ["Account", "About you", "Interests", "Finish"];

export function MembershipSignup() {
  const [values, setValues] = useState(initialValues);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resending, setResending] = useState(false);

  function set<K extends keyof SignupValues>(key: K, value: SignupValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return "Please enter a valid email address.";
      const requirements = passwordRequirements(values.password);
      if (!requirements.length || !requirements.number || !requirements.uppercase) return "Your password needs at least 8 characters, one number, and one uppercase letter.";
      if (values.password !== values.confirmPassword) return "Passwords don't match.";
      if (values.tier === "school" && values.schoolCode.trim().length < 8) return "Enter the school code provided by your school.";
    }
    if (step === 1 && (!values.firstName.trim() || !values.displayName.trim())) return "Add your first name and a display name to continue.";
    if (step === 3 && !values.acceptedTerms) return "Please agree to the Terms of Use and Privacy Policy to continue.";
    return "";
  }

  function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = validateCurrentStep();
    if (issue) { setError(issue); return; }
    setError("");
    setStep((current) => Math.min(current + 1, 3));
  }

  function back() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  function toggleInterest(interest: string) {
    setValues((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }));
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = validateCurrentStep();
    if (issue) { setError(issue); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/membership/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
      if (!result.hasSession) {
        setConfirmationEmail(values.email.trim());
        return;
      }
      window.location.assign(result.next || "/membership/success");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setResending(true); setResendMessage("");
    try {
      const response = await fetch("/api/membership/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: confirmationEmail }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t resend the email just now.");
      setResendMessage("If a new verification link is available, it’s on its way.");
    } catch (reason) {
      setResendMessage(reason instanceof Error ? reason.message : "We couldn’t resend the email just now.");
    } finally {
      setResending(false);
    }
  }

  if (confirmationEmail) {
    return <section className="membership-confirmation" aria-live="polite">
      <span className="membership-confirmation-mark" aria-hidden="true">✳</span>
      <span className="eyebrow">One last step</span>
      <h2>Check your inbox.</h2>
      <p>We sent a verification link to <strong>{confirmationEmail}</strong>. Confirm your email to continue to your membership.</p>
      <button className="button button-outline" type="button" onClick={resendVerification} disabled={resending}>
        {resending ? "Sending…" : "Resend verification email"}
      </button>
      {resendMessage && <p className="form-success" role="status">{resendMessage}</p>}
      <p className="privacy-note">If you don’t see it, check your spam folder. Your password is never included in the email.</p>
    </section>;
  }

  const requirements = passwordRequirements(values.password);
  const score = Number(requirements.length) + Number(requirements.number) + Number(requirements.uppercase);

  return <div className="membership-layout page-shell">
    <aside className="membership-intro">
      <Image src="/teens2inspire-logo.webp" alt="Teens2Inspire" width={384} height={128} className="membership-logo" priority />
      <span className="eyebrow eyebrow-line">Teens2Inspire community</span>
      <h1>Your place to<br /><em>connect &amp; grow.</em></h1>
      <p>Join Teens2Inspire and create your own space for inspiration, conversations, resources, events and more.</p>
      <div className="membership-intro-note"><span aria-hidden="true">✳</span><span>Inspiring Jewish teen girls.<br />A warm space to listen, watch, explore and connect.</span></div>
    </aside>

    <section className="membership-panel" aria-labelledby="membership-form-title">
      <div className="membership-panel-top"><span className="eyebrow">Your membership</span><span className="membership-free-note">Made for Jewish teen girls</span></div>
      <h2 id="membership-form-title">Make this space yours.</h2>
      <p className="membership-panel-lead">Choose the membership that fits you, then we’ll set up your private profile.</p>

      <ol className="membership-progress" aria-label="Sign-up progress">
        {stepNames.map((name, index) => <li key={name} className={index === step ? "is-current" : index < step ? "is-complete" : ""} aria-current={index === step ? "step" : undefined}>
          <span>{String(index + 1).padStart(2, "0")}</span><small>{name}</small>
        </li>)}
      </ol>

      <form className="membership-form" noValidate onSubmit={step === 3 ? createAccount : advance}>
        {step === 0 && <section className="membership-step" aria-labelledby="step-title">
          <div className="membership-step-heading"><span className="eyebrow">01 — Account</span><h3 id="step-title">Let’s get started.</h3><p>Choose your membership and create your secure sign-in.</p></div>
          <fieldset className="membership-plan-fieldset">
            <legend>Choose a membership</legend>
            <div className="membership-plan-grid">
              {membershipOptions.map((option) => <button type="button" key={option.id} className={`membership-plan-card${values.tier === option.id ? " is-selected" : ""}`} aria-pressed={values.tier === option.id} onClick={() => set("tier", option.id)}>
                <span className="membership-plan-topline"><strong>{option.name}</strong>{option.id === "family" && <span className="membership-plan-badge">3 profiles</span>}</span>
                <span className="membership-plan-price">{option.price}<small>{option.cadence}</small></span>
                <span className="membership-plan-description">{option.description}</span>
              </button>)}
            </div>
          </fieldset>
          {values.tier === "school" && <label className="membership-field">School code<input value={values.schoolCode} onChange={(event) => set("schoolCode", event.target.value)} autoComplete="off" placeholder="Enter the code from your school" aria-describedby="school-code-help" /><span id="school-code-help" className="field-help">Your school code keeps this membership free.</span></label>}
          <label className="membership-field">Email address<input type="email" inputMode="email" autoComplete="email" value={values.email} onChange={(event) => set("email", event.target.value)} placeholder="you@example.com" aria-describedby="email-help" /><span id="email-help" className="field-help">We’ll use this for sign-in and important account emails.</span></label>
          <div className="membership-password-grid">
            <label className="membership-field">Create a password<span className="membership-password-control"><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={values.password} onChange={(event) => set("password", event.target.value)} aria-describedby="password-rules" /><button type="button" className="password-visibility" onClick={() => setShowPassword((shown) => !shown)} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}<span className="sr-only"> password</span></button></span></label>
            <label className="membership-field">Confirm your password<input type={showPassword ? "text" : "password"} autoComplete="new-password" value={values.confirmPassword} onChange={(event) => set("confirmPassword", event.target.value)} aria-invalid={Boolean(values.confirmPassword && values.password !== values.confirmPassword)} aria-describedby="confirm-help" /><span id="confirm-help" className="field-help">{values.confirmPassword && values.password !== values.confirmPassword ? "Passwords don't match." : "Re-enter your password."}</span></label>
          </div>
          <div className="password-strength" id="password-rules" aria-live="polite">
            <div className={`strength-meter strength-${score}`}><i /><i /><i /></div><span>{score === 3 ? "Password looks good" : "Password requirements"}</span>
            <ul><li className={requirements.length ? "met" : ""}>At least 8 characters</li><li className={requirements.number ? "met" : ""}>At least one number</li><li className={requirements.uppercase ? "met" : ""}>At least one uppercase letter</li></ul>
          </div>
        </section>}

        {step === 1 && <section className="membership-step" aria-labelledby="step-title">
          <div className="membership-step-heading"><span className="eyebrow">02 — About you</span><h3 id="step-title">Tell us a little about yourself.</h3><p>This helps us personalize your Teens2Inspire experience. Share only what’s needed to make this space yours.</p></div>
          <label className="membership-field">First name<input value={values.firstName} onChange={(event) => set("firstName", event.target.value)} autoComplete="given-name" maxLength={60} /></label>
          <label className="membership-field">Display name<input value={values.displayName} onChange={(event) => set("displayName", event.target.value)} autoComplete="nickname" maxLength={40} aria-describedby="display-name-help" /><span id="display-name-help" className="field-help">This is the name you’ll see on your private Teens2Inspire profile. It can be different from your first name.</span></label>
          <p className="privacy-note">We don’t ask for your home address, phone number, school name or exact location.</p>
        </section>}

        {step === 2 && <section className="membership-step" aria-labelledby="step-title">
          <div className="membership-step-heading"><span className="eyebrow">03 — Your interests</span><h3 id="step-title">What are you into?</h3><p>Choose what you’d love to see more of. You can change this anytime.</p></div>
          <fieldset className="interest-fieldset"><legend className="sr-only">Choose any interests</legend><div className="interest-chip-list">
            {membershipInterests.map((interest) => <button key={interest} type="button" className={`interest-chip${values.interests.includes(interest) ? " is-selected" : ""}`} aria-pressed={values.interests.includes(interest)} onClick={() => toggleInterest(interest)}>{interest}</button>)}
          </div></fieldset>
          <p className="field-help">Optional · select as many as you like.</p>
        </section>}

        {step === 3 && <section className="membership-step" aria-labelledby="step-title">
          <div className="membership-step-heading"><span className="eyebrow">04 — Finish</span><h3 id="step-title">Make it yours.</h3><p>Your private profile will be ready after account confirmation.</p></div>
          <div className="membership-personalize"><span className="membership-avatar-placeholder" aria-hidden="true">✦</span><div><strong>Add a profile photo</strong><p>You can add one anytime from your profile settings. It stays private to your account.</p><Link href="/privacy">How we protect your privacy ↗</Link></div></div>
          <label className="membership-consent"><input type="checkbox" checked={values.acceptedTerms} onChange={(event) => set("acceptedTerms", event.target.checked)} /><span>I agree to the Teens2Inspire <Link href="/terms" target="_blank">Terms of Use</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.</span></label>
          <p className="membership-consent-note">Your profile and interests are private. You can review or update them after joining.</p>
        </section>}

        {error && <p className="form-error membership-error" role="alert">{error}</p>}
        <div className="membership-form-actions">
          {step > 0 ? <button className="membership-back" type="button" onClick={back}>← Back</button> : <span className="membership-secure-note"><span aria-hidden="true">✳</span> Private and secure</span>}
          {step === 2 && <button className="membership-skip" type="button" onClick={() => { setError(""); setStep(3); }}>Skip for now</button>}
          {step < 3
            ? <button className="button button-primary" type="submit">Continue <span aria-hidden="true">→</span></button>
            : <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Creating your account…" : "Join Teens2Inspire"}<span aria-hidden="true">↗</span></button>}
        </div>
      </form>
      <p className="membership-switch">Already part of the community? <Link href="/login">Sign in.</Link></p>
    </section>
  </div>;
}

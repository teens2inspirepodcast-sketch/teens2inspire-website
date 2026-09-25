import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookie Policy" };

export default function CookiesPage() {
  return <article className="legal-page page-shell">
    <span className="eyebrow eyebrow-line">A clear note about cookies</span>
    <h1>Cookie <em>policy.</em></h1>
    <p className="legal-lead">Teens2Inspire uses essential session cookies so account sign-in, saved items, and protected membership access can work.</p>
    <section><h2>Essential account cookies</h2><p>Supabase authentication stores session tokens in browser cookies so the site can recognize your account between page visits. In production, these cookies use the Secure setting over HTTPS and SameSite=Lax. They are needed for sign-in and membership features.</p></section>
    <section><h2>Analytics and advertising</h2><p>The current site does not intentionally set advertising or analytics cookies. If that changes, this page and any required consent controls should be updated before those tools are enabled.</p></section>
    <section><h2>Managing cookies</h2><p>You can clear cookies in your browser settings. Clearing the Teens2Inspire session cookie will sign you out. Some account and membership features will not work until you sign in again.</p></section>
    <p className="legal-note">Last updated September 24, 2026. This page describes the current implementation and should be reviewed for the jurisdictions where Teens2Inspire operates before launch.</p>
  </article>;
}

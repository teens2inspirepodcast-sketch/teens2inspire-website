import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  const supabase = await createClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/profile");
  }
  return <div className="auth-page page-shell"><div className="auth-art"><span className="eyebrow">A fresh start</span><h1>Back to<br /><em>your space.</em></h1><p>Enter your email and we’ll help you get back into your account.</p><span className="auth-art-star">✳</span></div><div className="auth-form-panel"><span className="eyebrow">Account access</span><h2>Reset your password.</h2><p>We’ll email you a link with the next steps.</p><ResetPasswordForm updating={false}/><p className="form-switch"><Link href="/login">Back to sign in.</Link></p></div></div>;
}

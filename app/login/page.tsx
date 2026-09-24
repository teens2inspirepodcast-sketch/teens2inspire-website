import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const supabase = await createClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/profile");
  }
  const { message } = await searchParams;
  return <div className="auth-page page-shell"><div className="auth-art"><span className="eyebrow">Your corner of the world</span><h1>Welcome<br /><em>back.</em></h1><p>Your Teens2Inspire space is waiting for you.</p><span className="auth-art-star">✳</span></div><div className="auth-form-panel"><span className="eyebrow">Continue with email</span><h2>Sign in</h2><p>Pick up right where you left off.</p>{message === "link-error" && <p className="form-error" role="alert">That link expired or couldn’t be verified. Request a fresh one and try again.</p>}<AuthForm mode="login"/><p className="form-switch"><Link href="/forgot-password">Forgot password?</Link></p><p className="form-switch">Don’t have an account? <Link href="/signup">Join Teens2Inspire.</Link></p></div></div>;
}

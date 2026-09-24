import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
export const metadata:Metadata={title:"Reset password"};
export default async function ResetPasswordPage({searchParams}:{searchParams:Promise<{update?:string}>}) {
  const {update}=await searchParams;const updating=update==="1";
  return <div className="auth-page page-shell"><div className="auth-art"><span className="eyebrow">A fresh start</span><h1>Back to<br/><em>your space.</em></h1><span className="auth-art-star">✳</span></div><div className="auth-form-panel"><span className="eyebrow">Account access</span><h2>{updating?"Choose a new password":"Reset your password"}</h2><p>{updating?"Pick a password you haven’t used here before.":"We’ll email you a link to get back in."}</p><ResetPasswordForm updating={updating}/><p className="form-switch"><Link href="/login">Back to sign in.</Link></p></div></div>;
}

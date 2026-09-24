"use client";

import { FormEvent,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function ResetPasswordForm({updating}:{updating:boolean}) {
  const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const router=useRouter();
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setMessage("");setError("");setBusy(true);
    try {
      const form=new FormData(event.currentTarget),supabase=createClient();
      if(updating) {
        const password=String(form.get("password")),confirm=String(form.get("confirm"));
        if(password!==confirm) throw new Error("Those passwords don’t match.");
        const {error:authError}=await supabase.auth.updateUser({password});if(authError)throw authError;
        setMessage("Your password has been updated. You can sign in now.");setTimeout(()=>router.push("/login"),1200);
      } else {
        const email=String(form.get("email"));const redirectTo=`${window.location.origin}/auth/callback?next=%2Freset-password%3Fupdate%3D1`;
        const {error:authError}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});if(authError)throw authError;
        setMessage("If an account uses that email, a reset link is on its way.");
      }
    } catch(e) { setError(e instanceof Error?e.message:"We couldn't complete that. Please try again."); }
    finally { setBusy(false); }
  }
  return <form className="stack-form" onSubmit={submit}>{updating?<><label>New password<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label><label>Confirm password<input name="confirm" type="password" minLength={8} autoComplete="new-password" required /></label></>:<label>Email address<input name="email" type="email" autoComplete="email" required /></label>}{error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="form-success" role="status">{message}</p>}<button className="button button-primary" disabled={busy}>{busy?"One moment…":updating?"Update password":"Send reset link"}<span>↗</span></button></form>;
}

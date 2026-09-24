"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
export function SignOutButton() { const router = useRouter(); return <button className="button button-outline" onClick={async()=>{await createClient().auth.signOut();router.push("/");router.refresh();}}>Sign out</button>; }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-url";

export async function POST(request: Request) {
  let email = "";
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ error: "Enter your email address and try again." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Verification email isn’t available right now." }, { status: 503 });
  const origin = getSiteOrigin(request.url);
  if (!origin) return NextResponse.json({ error: "Verification email isn’t available right now." }, { status: 503 });
  const redirectTo = new URL("/auth/callback?next=%2Fmembership%2Fsuccess", origin).toString();
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectTo } });
  if (error) return NextResponse.json({ error: "We couldn’t resend the email just now. Please wait a moment and try again." }, { status: 503 });
  return NextResponse.json({ ok: true });
}

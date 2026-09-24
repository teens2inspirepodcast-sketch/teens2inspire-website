import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Membership status is not available." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view membership status." }, { status: 401 });
  const { data: profile, error } = await supabase.from("profiles").select("membership_tier,membership_status").eq("id", user.id).maybeSingle();
  if (error || !profile) return NextResponse.json({ error: "Membership status is not available." }, { status: 503 });
  return NextResponse.json({ tier: profile.membership_tier, status: profile.membership_status });
}

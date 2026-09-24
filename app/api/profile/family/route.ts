import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function signedInClient() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "Profile settings are not available right now." }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in to manage family profiles." }, { status: 401 }) };
  return { supabase, user };
}

export async function POST(request: Request) {
  let body: { firstName?: unknown; displayName?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Enter a first name and display name." }, { status: 400 }); }
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (!firstName || firstName.length > 60 || !displayName || displayName.length > 40) return NextResponse.json({ error: "Enter a first name and a display name under 40 characters." }, { status: 400 });
  const auth = await signedInClient();
  if ("error" in auth) return auth.error;
  const { error } = await auth.supabase.rpc("add_family_profile", { p_first_name: firstName, p_display_name: displayName, p_interests: [] });
  if (error) return NextResponse.json({ error: error.message.includes("three profiles") ? error.message : "We couldn’t add that profile. Check your membership and try again." }, { status: 403 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  let body: { id?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Choose a profile to remove." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Choose a valid profile to remove." }, { status: 400 });
  const auth = await signedInClient();
  if ("error" in auth) return auth.error;
  const { error } = await auth.supabase.rpc("remove_family_profile", { p_profile_id: id });
  if (error) return NextResponse.json({ error: "We couldn’t remove that profile. Please try again." }, { status: 400 });
  return NextResponse.json({ ok: true });
}

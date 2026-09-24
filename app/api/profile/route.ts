import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { membershipInterests } from "@/lib/membership";

export async function PUT(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Check your profile details and try again." }, { status: 400 }); }
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const validInterests = Array.isArray(body.interests)
    ? body.interests.filter((value): value is string => typeof value === "string" && membershipInterests.includes(value as (typeof membershipInterests)[number]))
    : [];
  const interests = [...new Set(validInterests)].slice(0, membershipInterests.length);
  const avatarPath = typeof body.avatarPath === "string" ? body.avatarPath : undefined;
  if (!firstName || firstName.length > 60 || !displayName || displayName.length > 40) {
    return NextResponse.json({ error: "Enter a first name and a display name under 40 characters." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Profile settings are not available right now." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
  if (avatarPath && (!avatarPath.startsWith(`${user.id}/profile-photo.`) || !/\.(jpg|png|webp)$/.test(avatarPath))) {
    return NextResponse.json({ error: "That profile photo path isn’t valid." }, { status: 400 });
  }

  const update = { first_name: firstName, display_name: displayName, interests, ...(avatarPath ? { avatar_path: avatarPath } : {}) };
  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return NextResponse.json({ error: "We couldn’t save your profile. Please try again." }, { status: 503 });
  return NextResponse.json({ ok: true });
}

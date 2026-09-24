import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { schoolName?: unknown; maxUses?: unknown; expiresInDays?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Check the school code settings and try again." }, { status: 400 }); }
  const schoolName = typeof body.schoolName === "string" ? body.schoolName.trim() : "";
  const maxUses = Number(body.maxUses);
  const expiresInDays = body.expiresInDays === "" || body.expiresInDays == null ? null : Number(body.expiresInDays);
  if (!schoolName || schoolName.length > 120 || !Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) {
    return NextResponse.json({ error: "Enter a school name and a valid number of uses." }, { status: 400 });
  }
  if (expiresInDays !== null && (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 3650)) {
    return NextResponse.json({ error: "Set an expiry from 1 to 3,650 days, or leave it blank." }, { status: 400 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "School code management is not available right now." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in as an administrator to create school codes." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "administrator") return NextResponse.json({ error: "Only administrators can create school codes." }, { status: 403 });

  const code = randomBytes(12).toString("hex").toUpperCase();
  const codeHash = createHash("sha256").update(code.toLowerCase()).digest("hex");
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : null;
  const { error } = await supabase.rpc("issue_school_code", {
    p_code_hash: codeHash,
    p_school_name: schoolName,
    p_max_uses: maxUses,
    p_expires_at: expiresAt,
  });
  if (error) return NextResponse.json({ error: "The school code couldn’t be created. Check that the membership database update has been applied." }, { status: 503 });
  return NextResponse.json({ code, schoolName, maxUses, expiresAt }, { status: 201 });
}

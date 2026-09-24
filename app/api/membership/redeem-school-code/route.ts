import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeSchoolCode } from "@/lib/membership";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Please reload the page and try again." }, { status: 403 });
  let body: { code?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Enter the school code to continue." }, { status: 400 }); }
  const code = typeof body.code === "string" ? normalizeSchoolCode(body.code) : "";
  if (code.length < 8 || code.length > 64) return NextResponse.json({ error: "Enter a valid school code." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "School membership is not available right now." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to apply your school code." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("membership_tier,membership_status").eq("id", user.id).maybeSingle();
  if (profile?.membership_tier !== "school" || profile.membership_status !== "pending_school_code") {
    return NextResponse.json({ error: "This account is not waiting for a school code." }, { status: 409 });
  }
  const codeHash = createHash("sha256").update(code.toLowerCase()).digest("hex");
  const { data: valid, error: validationError } = await supabase.rpc("validate_school_code", { p_code_hash: codeHash });
  if (validationError) return NextResponse.json({ error: "School-code membership is not set up yet." }, { status: 503 });
  if (valid !== true) return NextResponse.json({ error: "That school code isn’t valid or has already been used the allowed number of times." }, { status: 400 });
  const { error } = await supabase.rpc("redeem_school_code", { p_code_hash: codeHash });
  if (error) return NextResponse.json({ error: "We couldn’t apply that code. Please try again." }, { status: 400 });
  return NextResponse.json({ ok: true });
}

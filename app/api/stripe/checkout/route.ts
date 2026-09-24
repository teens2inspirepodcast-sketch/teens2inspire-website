import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMemberCheckout } from "@/lib/stripe";
import { getSiteOrigin } from "@/lib/site-url";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const siteOrigin = getSiteOrigin(request.url);
  if (!siteOrigin) return NextResponse.json({ error: "Membership checkout is not available right now." }, { status: 503 });
  if (origin && origin !== siteOrigin) return NextResponse.json({ error: "Please reload the page and try again." }, { status: 403 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Membership checkout is not available right now." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Sign in to continue to checkout." }, { status: 401 });
  const result = await createMemberCheckout(supabase, user.id, user.email, siteOrigin);
  if (!("url" in result)) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url });
}

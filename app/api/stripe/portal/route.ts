import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getSiteOrigin } from "@/lib/site-url";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const siteOrigin = getSiteOrigin(request.url);
  if (!siteOrigin) return NextResponse.json({ error: "Billing is not available right now." }, { status: 503 });
  if (origin && origin !== siteOrigin) return NextResponse.json({ error: "Please reload the page and try again." }, { status: 403 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Billing is not available right now." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage your membership." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("stripe_customer_id,membership_tier").eq("id", user.id).maybeSingle();
  if (!profile || profile.membership_tier === "school" || !profile.stripe_customer_id) {
    return NextResponse.json({ error: "There isn’t a paid membership to manage on this account." }, { status: 400 });
  }
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: new URL("/profile", siteOrigin).toString(),
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "We couldn’t open billing settings. Please try again shortly." }, { status: 503 });
  }
}

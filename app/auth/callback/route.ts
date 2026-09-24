import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMemberCheckout } from "@/lib/stripe";
import { getSiteOrigin } from "@/lib/site-url";

export async function GET(request:NextRequest) {
  const requestUrl=new URL(request.url), origin=getSiteOrigin(request.url) ?? requestUrl.origin, code=requestUrl.searchParams.get("code"), target=requestUrl.searchParams.get("next")||"/profile";
  const candidate=new URL(target,origin), next=candidate.origin===origin?candidate:new URL("/profile",origin);
  const supabase=await createClient();
  if(!supabase) return NextResponse.redirect(new URL("/login?message=link-error",origin));
  if(code) {
    const {error}=await supabase.auth.exchangeCodeForSession(code);
    if(error) return NextResponse.redirect(new URL("/login?message=link-error",origin));
  }

  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.redirect(new URL("/login?message=link-error",origin));
  const {data:profile}=await supabase.from("profiles").select("membership_tier,membership_status").eq("id",user.id).maybeSingle();
  if(!profile) return NextResponse.redirect(new URL("/profile?membership=setup",origin));

  // Password recovery should return to its reset form, not reopen paid checkout.
  if(next.pathname === "/reset-password") return NextResponse.redirect(next);

  if(profile.membership_tier==="school" && profile.membership_status==="pending_school_code") {
    const codeHash=user.user_metadata?.school_code_hash;
    if(typeof codeHash==="string" && /^[0-9a-f]{64}$/.test(codeHash)) {
      const {error}=await supabase.rpc("redeem_school_code",{p_code_hash:codeHash});
      if(!error) {
        const {school_code_hash:_discard,...metadata}=user.user_metadata||{};
        await supabase.auth.updateUser({data:metadata});
      }
    }
    const {data:updatedProfile}=await supabase.from("profiles").select("membership_status").eq("id",user.id).maybeSingle();
    if(updatedProfile?.membership_status!=="active") return NextResponse.redirect(new URL("/profile?membership=school-code-help",origin));
  }

  if((profile.membership_tier==="personal" || profile.membership_tier==="family") && profile.membership_status==="pending_payment") {
    if(!user.email) return NextResponse.redirect(new URL("/profile?membership=checkout-pending",origin));
    const checkout=await createMemberCheckout(supabase,user.id,user.email,origin);
    if("url" in checkout && typeof checkout.url === "string") return NextResponse.redirect(checkout.url);
    return NextResponse.redirect(new URL("/profile?membership=checkout-pending",origin));
  }

  return NextResponse.redirect(next);
}

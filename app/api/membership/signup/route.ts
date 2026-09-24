import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isMembershipTier, membershipInterests, normalizeSchoolCode, passwordRequirements } from "@/lib/membership";
import { isMembershipBillingConfigured } from "@/lib/stripe";
import { getSiteOrigin } from "@/lib/site-url";

function invalid(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return invalid("Please check the form and try again.");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const tier = body.tier;
  const schoolCode = typeof body.schoolCode === "string" ? normalizeSchoolCode(body.schoolCode) : "";
  const validInterests = Array.isArray(body.interests)
    ? body.interests.filter((value): value is string => typeof value === "string" && membershipInterests.includes(value as (typeof membershipInterests)[number]))
    : [];
  const interests = [...new Set(validInterests)].slice(0, membershipInterests.length);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return invalid("Please enter a valid email address.");
  const requirements = passwordRequirements(password);
  if (!requirements.length || !requirements.number || !requirements.uppercase) return invalid("Use at least 8 characters, one number, and one uppercase letter for your password.");
  if (password !== confirmPassword) return invalid("Passwords don't match.");
  if (!firstName || firstName.length > 60) return invalid("Please enter a first name.");
  if (!displayName || displayName.length > 40) return invalid("Please enter a display name under 40 characters.");
  if (!isMembershipTier(tier)) return invalid("Choose a membership option to continue.");
  if (body.acceptedTerms !== true) return invalid("Please agree to the Terms of Use and Privacy Policy to continue.");
  if (tier === "school" && (schoolCode.length < 8 || schoolCode.length > 64)) return invalid("Enter the school code provided by your school.");
  if (tier !== "school" && !isMembershipBillingConfigured(tier)) {
    return invalid("Personal and Family checkout is not connected yet. Please try again soon or choose a school membership if you have a code.", 503);
  }

  const supabase = await createClient();
  if (!supabase) return invalid("Membership sign-up is not available right now. Please try again soon.", 503);

  let schoolCodeHash = "";
  if (tier === "school") {
    schoolCodeHash = createHash("sha256").update(schoolCode.toLowerCase()).digest("hex");
    const { data: codeIsValid, error: codeError } = await supabase.rpc("validate_school_code", { p_code_hash: schoolCodeHash });
    if (codeError) return invalid("School-code membership is not set up yet. Please contact Teens2Inspire for help.", 503);
    if (codeIsValid !== true) return invalid("That school code isn’t valid or has already been used the allowed number of times.");
  }

  const origin = getSiteOrigin(request.url);
  if (!origin) return invalid("Membership sign-up is not available right now. Please try again soon.", 503);
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) return invalid("Please reload the page and try again.", 403);
  const redirectTo = new URL("/auth/callback?next=%2Fmembership%2Fsuccess", origin).toString();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        display_name: displayName,
        interests,
        membership_tier: tier,
        ...(tier === "school" ? { school_code_hash: schoolCodeHash } : {}),
        accepted_terms_at: new Date().toISOString(),
      },
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already registered") || message.includes("already been registered")) {
      return invalid("An account may already use that email. Sign in or reset your password instead.", 409);
    }
    if (message.includes("database error") || message.includes("saving new user")) {
      return invalid("Membership setup needs to be finished in Supabase before accounts can be created.", 503);
    }
    if (message.includes("password")) return invalid("Please choose a password that meets the requirements.");
    return invalid("We couldn’t create your account. Please check your details and try again.", 400);
  }

  return NextResponse.json({
    ok: true,
    hasSession: Boolean(data.session),
    next: "/auth/callback?next=%2Fmembership%2Fsuccess",
    tier,
  }, { status: 201 });
}

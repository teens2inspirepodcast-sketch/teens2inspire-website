import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MembershipSuccessStatus } from "@/components/MembershipSuccessStatus";
import { isMembershipTier } from "@/lib/membership";

export const metadata: Metadata = { title: "Welcome to Teens2Inspire" };

export default async function MembershipSuccessPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("membership_tier,membership_status").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/profile?membership=setup");
  const tier = isMembershipTier(profile.membership_tier) ? profile.membership_tier : "personal";
  return <main className="membership-success-page page-shell"><MembershipSuccessStatus tier={tier} active={profile.membership_status === "active"} /></main>;
}

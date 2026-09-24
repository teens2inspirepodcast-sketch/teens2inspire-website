import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";
import { SignOutButton } from "@/components/SignOutButton";
import { ProfileSettingsForm } from "@/components/ProfileSettingsForm";
import { FamilyProfilesManager } from "@/components/FamilyProfilesManager";
import { MembershipActionButton } from "@/components/MembershipActionButton";
import { SchoolCodeForm } from "@/components/SchoolCodeForm";
import { membershipOptions, isMembershipTier, type MembershipTier } from "@/lib/membership";
import type { ContentRecord } from "@/lib/content";

export const metadata: Metadata = { title: "My profile" };

type ProfileDetails = {
  first_name: string | null;
  display_name: string | null;
  interests: string[] | null;
  avatar_path: string | null;
  membership_tier: string | null;
  membership_status: string | null;
  stripe_customer_id: string | null;
  membership_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ membership?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  if (!supabase) return <div className="empty-library page-shell"><h1>Your space is almost ready.</h1><p>Add your Supabase settings to get started.</p></div>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileResult, savedResult, historyResult] = await Promise.all([
    supabase.from("profiles").select("first_name,display_name,interests,avatar_path,membership_tier,membership_status,stripe_customer_id,membership_period_end,cancel_at_period_end").eq("id", user.id).maybeSingle(),
    supabase.from("favorites").select("content(*)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("content_views").select("viewed_at, content(*)").eq("user_id", user.id).order("viewed_at", { ascending: false }).limit(8),
  ]);

  const profile = profileResult.error ? null : profileResult.data as ProfileDetails | null;
  const favorites = (savedResult.data ?? []).map((row: any) => row.content).filter((item: any) => item?.status === "published") as ContentRecord[];
  const viewed = (historyResult.data ?? []).map((row: any) => row.content).filter((item: any) => item?.status === "published") as ContentRecord[];
  const name = profile?.first_name || (typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : "friend");
  const tier: MembershipTier = isMembershipTier(profile?.membership_tier) ? profile.membership_tier : "personal";
  const membership = membershipOptions.find((option) => option.id === tier)!;
  const status = profile?.membership_status ?? "inactive";
  const isSchoolPending = tier === "school" && status === "pending_school_code";
  const isPaidActive = tier !== "school" && status === "active";
  const hasBillingAccount = tier !== "school" && Boolean(profile?.stripe_customer_id);
  const { data: photoData } = profile?.avatar_path
    ? await supabase.storage.from("profile-photos").createSignedUrl(profile.avatar_path, 60 * 60)
    : { data: null };
  const displayName = profile?.display_name?.trim() || (typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : name);
  const { data: familyProfiles } = tier === "family" && status === "active"
    ? await supabase.from("family_profiles").select("id,first_name,display_name,interests").eq("owner_id", user.id).order("created_at", { ascending: true })
    : { data: [] };

  const membershipMessage: Record<string, string> = {
    setup: "One small setup step is still needed in the membership database. Your saved content is still here.",
    "school-code-help": "Your account is ready, but the school code could not be applied. Enter it below or contact Teens2Inspire for help.",
    "checkout-pending": "Your account is ready. Continue to secure checkout to activate your membership.",
    "checkout-canceled": "Checkout was canceled. You can continue whenever you’re ready.",
  };

  return <div className="profile-page page-shell">
    <div className="profile-welcome"><div><span className="eyebrow eyebrow-line">My profile</span><h1>Hi, {name}.</h1><p>A little home for the things you want to come back to.</p></div><SignOutButton /></div>

    {membershipMessage[params.membership || ""] && <p className="profile-membership-notice" role="status">{membershipMessage[params.membership || ""]}</p>}

    {profileResult.error || !profile ? <section className="profile-membership-card"><span className="eyebrow">Account setup</span><h2>One small step left.</h2><p>Apply the Teens2Inspire membership database update in Supabase to finish setting up your private profile and membership.</p></section> : <section className="profile-membership-card" aria-labelledby="membership-heading">
      <div className="section-heading"><div><span className="eyebrow">Your membership</span><h2 id="membership-heading">{membership.name}</h2></div><span className={`membership-status-pill membership-status-${status}`}>{status.replaceAll("_", " ")}</span></div>
      <p>{tier === "school" ? "Free access through your school." : `${membership.price} ${membership.cadence}${tier === "family" ? " · includes three profiles" : ""}`}</p>
      {isSchoolPending && <><p>Your school membership is free with a code from your school.</p><SchoolCodeForm /></>}
      {tier === "school" && status === "active" && <p>Your school membership is active.</p>}
      {tier !== "school" && !isPaidActive && <><p>{status === "past_due" ? "There’s a payment update needed for your membership." : status === "canceled" ? "Your paid membership is no longer active." : "Finish setting up your membership to unlock your account."}</p><MembershipActionButton action={hasBillingAccount && status === "past_due" ? "portal" : "checkout"} /></>}
      {isPaidActive && <><p>{tier === "family" ? "Your family space includes three profiles in total." : "Your Teens2Inspire membership is active."}{profile?.membership_period_end ? ` Renews or ends ${new Date(profile.membership_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}${profile.cancel_at_period_end ? " (canceled at period end)" : ""}.` : ""}</p><MembershipActionButton action="portal" /></>}
    </section>}

    {tier === "family" && status === "active" && <FamilyProfilesManager profiles={(familyProfiles ?? []) as { id: string; first_name: string; display_name: string; interests: string[] }[]} />}

    <section className="profile-section"><div className="section-heading"><div><span className="eyebrow">Keep what speaks to you</span><h2>Saved for later</h2></div><Link className="text-link" href="/saved">See all <span>↗</span></Link></div>{favorites.length ? <div className="media-shelf">{favorites.map((item) => <MediaCard key={item.id} item={item} />)}</div> : <div className="empty-note"><span className="empty-sparkle">♡</span><div><strong>Your saved space is waiting.</strong><p>Save a podcast, video or resource to find it here later.</p></div><Link className="text-link" href="/listen">Find something <span>↗</span></Link></div>}</section>

    <section className="profile-section"><div className="section-heading"><div><span className="eyebrow">Pick up where you left off</span><h2>Recently viewed</h2></div></div>{viewed.length ? <div className="media-shelf">{viewed.map((item) => <MediaCard key={item.id} item={item} />)}</div> : <div className="empty-note"><span className="empty-sparkle">↺</span><div><strong>Your recent finds will live here.</strong><p>Open a podcast, video or resource and it’ll be easy to find again.</p></div></div>}</section>

    {profile && <section className="profile-section profile-settings-section"><div className="section-heading"><div><span className="eyebrow">Private to your account</span><h2>Account settings</h2></div></div><ProfileSettingsForm userId={user.id} email={user.email ?? ""} firstName={profile.first_name || name} displayName={displayName} interests={profile.interests ?? []} avatarUrl={photoData?.signedUrl ?? ""} /></section>}
  </div>;
}

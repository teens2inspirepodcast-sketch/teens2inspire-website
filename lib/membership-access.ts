import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type MembershipProfile = {
  role: string | null;
  membership_tier: string | null;
  membership_status: string | null;
  membership_period_end: string | null;
  stripe_subscription_id: string | null;
};

export type ViewerAccess = {
  isSignedIn: boolean;
  canWatchVideos: boolean;
  isAdministrator: boolean;
};

export async function getViewerAccess(client?: SupabaseClient | null): Promise<ViewerAccess> {
  const supabase = client === undefined ? await createClient() : client;
  if (!supabase) return { isSignedIn: false, canWatchVideos: false, isAdministrator: false };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isSignedIn: false, canWatchVideos: false, isAdministrator: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,membership_tier,membership_status,membership_period_end,stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle();

  const membership = profile as MembershipProfile | null;
  const isAdministrator = membership?.role === "administrator";
  const verifiedEmail = Boolean(user.email_confirmed_at);
  const paidMembership =
    (membership?.membership_tier === "personal" || membership?.membership_tier === "family") &&
    membership.membership_status === "active" &&
    Boolean(membership.stripe_subscription_id) &&
    Boolean(membership.membership_period_end && Date.parse(membership.membership_period_end) > Date.now());

  return {
    isSignedIn: true,
    isAdministrator,
    canWatchVideos: verifiedEmail && (isAdministrator || paidMembership),
  };
}

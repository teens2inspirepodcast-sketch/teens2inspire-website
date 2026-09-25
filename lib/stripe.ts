import "server-only";
import { createHash } from "node:crypto";
import Stripe from "stripe";
import type { MembershipTier } from "@/lib/membership";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function stripePriceIdFor(tier: MembershipTier) {
  if (tier === "personal") return process.env.STRIPE_PRICE_PERSONAL_MONTHLY || "";
  if (tier === "family") return process.env.STRIPE_PRICE_FAMILY_MONTHLY || "";
  return "";
}

export function isMembershipBillingConfigured(tier: MembershipTier) {
  return tier !== "school" && Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    stripePriceIdFor(tier),
  );
}

export function stripeStatusToMembershipStatus(status: Stripe.Subscription.Status) {
  if (status === "active" || status === "trialing") return "active" as const;
  if (status === "past_due") return "past_due" as const;
  if (status === "canceled" || status === "unpaid" || status === "paused" || status === "incomplete_expired") return "canceled" as const;
  return "pending_payment" as const;
}

export async function createMemberCheckout(supabase: SupabaseClient, userId: string, email: string, origin: string, requestedTier?: "personal" | "family") {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("membership_tier,membership_status,stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) return { error: "Your membership profile is not ready yet.", status: 503 as const };
  const tier = requestedTier ?? profile.membership_tier;
  if (tier !== "personal" && tier !== "family") {
    return { error: "Choose a paid Personal or Family plan to unlock videos.", status: 400 as const };
  }
  const isAlreadyPaidAccount = profile.membership_tier === "personal" || profile.membership_tier === "family";
  if (isAlreadyPaidAccount && requestedTier && requestedTier !== profile.membership_tier) {
    return { error: "Manage billing to change your paid plan.", status: 409 as const };
  }
  if (isAlreadyPaidAccount && profile.membership_status === "active") return { error: "Your membership is already active.", status: 409 as const };
  if (isAlreadyPaidAccount && profile.membership_status === "past_due") return { error: "Use Manage billing to update your payment method.", status: 409 as const };
  if (!isMembershipBillingConfigured(tier)) {
    return { error: "Secure monthly checkout is not fully configured yet.", status: 503 as const };
  }

  const stripe = getStripe();
  const priceId = stripePriceIdFor(tier);
  const admin = createAdminClient();
  if (!stripe || !priceId || !admin) return { error: "Secure monthly checkout is not fully configured yet.", status: 503 as const };

  try {
    let customerId = profile.stripe_customer_id;
    if (customerId) {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) return { error: "We couldn’t open secure checkout. Please contact Teens2Inspire for help.", status: 503 as const };
      if (customer.metadata.supabase_user_id !== userId) {
        await stripe.customers.update(customerId, { metadata: { ...customer.metadata, supabase_user_id: userId } });
      }
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      }, { idempotencyKey: `teens2inspire-customer-${userId}-${createHash("sha256").update(email.toLowerCase()).digest("hex")}` });
      customerId = customer.id;
      const { error } = await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
      if (error) return { error: "Your billing profile could not be prepared. Please try again shortly.", status: 503 as const };
    }

    const openSessions = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
    const matchingSession = openSessions.data.find((session) =>
      session.mode === "subscription" && session.metadata?.supabase_user_id === userId &&
      session.metadata?.membership_tier === tier && session.url,
    );
    if (matchingSession?.url) return { url: matchingSession.url };
    for (const session of openSessions.data) {
      if (session.mode === "subscription" && session.metadata?.supabase_user_id === userId) {
        await stripe.checkout.sessions.expire(session.id);
      }
    }

    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    const existingSubscription = subscriptions.data.find((subscription) =>
      ["active", "trialing", "past_due", "unpaid", "paused"].includes(subscription.status),
    );
    if (existingSubscription) return { error: "There is already a paid membership on this account. Refresh your profile or manage billing.", status: 409 as const };

    const price = await stripe.prices.retrieve(priceId);
    const expectedAmount = tier === "personal" ? 799 : 999;
    if (!price.active || price.currency !== "usd" || price.unit_amount !== expectedAmount || price.recurring?.interval !== "month") {
      return { error: "The monthly membership prices need to be checked in Stripe before checkout can start.", status: 503 as const };
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      customer: customerId,
      metadata: { supabase_user_id: userId, membership_tier: tier },
      subscription_data: { metadata: { supabase_user_id: userId, membership_tier: tier } },
      success_url: new URL("/membership/success", origin).toString(),
      cancel_url: new URL("/profile?membership=checkout-canceled", origin).toString(),
    }, { idempotencyKey: `teens2inspire-checkout-${userId}-${tier}-${Math.floor(Date.now() / 300000)}` });
    if (!session.url) return { error: "Stripe did not return a checkout link. Please try again.", status: 503 as const };
    return { url: session.url };
  } catch {
    return { error: "We couldn’t open secure checkout. Please try again shortly.", status: 503 as const };
  }
}

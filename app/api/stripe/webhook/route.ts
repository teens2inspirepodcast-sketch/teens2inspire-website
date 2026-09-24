import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeStatusToMembershipStatus } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMembershipTier } from "@/lib/membership";

function periodEndDate(subscription: Stripe.Subscription) {
  const end = Math.max(0, ...subscription.items.data.map((item) => item.current_period_end));
  return end ? new Date(end * 1000).toISOString() : null;
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = createAdminClient();
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !webhookSecret || !admin || !signature) {
    return NextResponse.json({ error: "Webhook configuration is incomplete." }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id || session.metadata?.supabase_user_id;
    const tier = session.metadata?.membership_tier;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!userId || !isMembershipTier(tier) || tier === "school" || !subscriptionId) {
      return NextResponse.json({ error: "Checkout is missing membership details." }, { status: 400 });
    }
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const { error } = await admin.from("profiles").update({
        membership_tier: tier,
        membership_status: stripeStatusToMembershipStatus(subscription.status),
        stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
        stripe_subscription_id: subscription.id,
        membership_period_end: periodEndDate(subscription),
        cancel_at_period_end: subscription.cancel_at_period_end,
      }).eq("id", userId);
      if (error) return NextResponse.json({ error: "Membership could not be updated." }, { status: 500 });
    } catch {
      return NextResponse.json({ error: "Subscription could not be retrieved." }, { status: 500 });
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata.supabase_user_id;
    const tier = subscription.metadata.membership_tier;
    if (!userId || !isMembershipTier(tier) || tier === "school") return NextResponse.json({ received: true });
    const { error } = await admin.from("profiles").update({
      membership_tier: tier,
      membership_status: stripeStatusToMembershipStatus(subscription.status),
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      membership_period_end: periodEndDate(subscription),
      cancel_at_period_end: subscription.cancel_at_period_end,
    }).eq("id", userId).or(`stripe_subscription_id.eq.${subscription.id},stripe_subscription_id.is.null`);
    if (error) return NextResponse.json({ error: "Membership could not be updated." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

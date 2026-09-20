import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Stripe webhook: keeps the condominio's subscription status in sync
// (trial ending, payment failed, canceled, etc). Configure this endpoint
// URL in the Stripe dashboard and set STRIPE_WEBHOOK_SECRET.
export async function POST(request) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const stripe = getStripe();
    event = webhookSecret
      ? stripe.webhooks.constructEvent(payload, signature, webhookSecret)
      : JSON.parse(payload);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const subscriptionEvents = new Set([
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.trial_will_end",
  ]);

  if (subscriptionEvents.has(event.type)) {
    const subscription = event.data.object;
    try {
      const supabaseAdmin = getSupabaseAdmin();
      await supabaseAdmin
        .from("condominios")
        .update({ status: subscription.status })
        .eq("stripe_subscription_id", subscription.id);
    } catch (err) {
      console.error("Erro ao sincronizar assinatura:", err);
    }
  }

  return NextResponse.json({ received: true });
}

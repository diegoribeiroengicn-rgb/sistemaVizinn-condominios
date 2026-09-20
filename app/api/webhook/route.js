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

  // Statuses set manually from /admin (suspend/courtesy/promise) — never
  // clobbered by a routine Stripe sync, since none of them come from
  // Stripe's own subscription.status. A real cancellation still wins.
  const ADMIN_CONTROLLED_STATUSES = new Set(["suspended", "cortesia", "promessa"]);

  if (subscriptionEvents.has(event.type)) {
    const subscription = event.data.object;
    try {
      const supabaseAdmin = getSupabaseAdmin();

      if (event.type === "customer.subscription.deleted") {
        await supabaseAdmin
          .from("condominios")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);
      } else {
        const { data: existing } = await supabaseAdmin
          .from("condominios")
          .select("status")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        // Skip: this row is under manual admin control (or this update is
        // just Stripe confirming the pause_collection we set ourselves).
        if (existing && !ADMIN_CONTROLLED_STATUSES.has(existing.status)) {
          await supabaseAdmin
            .from("condominios")
            .update({ status: subscription.status })
            .eq("stripe_subscription_id", subscription.id);
        }
      }
    } catch (err) {
      console.error("Erro ao sincronizar assinatura:", err);
    }
  }

  return NextResponse.json({ received: true });
}

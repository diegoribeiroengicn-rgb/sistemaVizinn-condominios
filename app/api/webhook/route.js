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
        // Antes de marcar como cancelado, confere se esse condomínio
        // nunca chegou a converter (ainda estava "trialing" quando
        // cancelou) — se foi esse o caso, a comissão de venda que o
        // vendedor recebeu nunca teve receita recorrente por trás, só
        // a adesão única. Estorna o que ainda não foi pago (nunca mexe
        // em comissão já paga) pra não deixar a empresa no prejuízo
        // líquido numa venda que não gerou assinatura nenhuma.
        const { data: condominioAtual } = await supabaseAdmin
          .from("condominios")
          .select("id, status")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        await supabaseAdmin
          .from("condominios")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);

        if (condominioAtual?.status === "trialing") {
          const { error: erroEstorno } = await supabaseAdmin
            .from("comissoes")
            .update({
              status: "cancelada",
              observacao: "Estornada: condomínio cancelou ainda no período de teste, sem converter em assinatura paga.",
              updated_at: new Date().toISOString(),
            })
            .eq("condominio_id", condominioAtual.id)
            .in("status", ["pendente", "gerada", "aprovada"]);
          if (erroEstorno) console.error("Erro ao estornar comissões de condomínio cancelado no trial:", erroEstorno.message);
        }
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

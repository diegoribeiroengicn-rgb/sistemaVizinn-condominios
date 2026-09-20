import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Platform-owner-only: cancels a tenant's Stripe subscription and marks
// their condominio as canceled.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { condominioId, subscriptionId } = await request.json();
  if (!condominioId) {
    return NextResponse.json({ error: "condominioId é obrigatório." }, { status: 400 });
  }

  try {
    if (subscriptionId) {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(subscriptionId).catch((err) => {
        // Already canceled on Stripe's side — proceed to sync our record.
        if (err.code !== "resource_missing") throw err;
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("condominios")
      .update({ status: "canceled" })
      .eq("id", condominioId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin/cancel-subscription error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao cancelar assinatura." },
      { status: 500 }
    );
  }
}

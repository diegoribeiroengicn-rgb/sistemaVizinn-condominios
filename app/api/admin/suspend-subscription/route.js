import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Platform-owner-only: pauses a tenant's access. If they have a live
// Stripe subscription, pauses billing collection there too (so no charge
// happens while suspended, but the subscription itself isn't canceled and
// can be resumed later via /api/admin/reactivate-subscription).
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { condominioId, subscriptionId, note } = await request.json();
  if (!condominioId) {
    return NextResponse.json({ error: "condominioId é obrigatório." }, { status: 400 });
  }

  try {
    if (subscriptionId) {
      const stripe = getStripe();
      await stripe.subscriptions
        .update(subscriptionId, { pause_collection: { behavior: "void" } })
        .catch((err) => {
          if (err.code !== "resource_missing") throw err;
        });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("condominios")
      .update({ status: "suspended", access_note: note || null })
      .eq("id", condominioId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin/suspend-subscription error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao suspender o condomínio." },
      { status: 500 }
    );
  }
}

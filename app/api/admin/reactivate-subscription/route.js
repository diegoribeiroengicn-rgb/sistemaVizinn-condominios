import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Platform-owner-only: resumes a suspended tenant. Resumes Stripe billing
// collection if they have a subscription (status then follows whatever
// Stripe reports); otherwise just flips the local status back to active.
export async function POST(request) {
  const auth = await requireAdmin(request, "condominios");
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { condominioId, subscriptionId } = await request.json();
  if (!condominioId) {
    return NextResponse.json({ error: "condominioId é obrigatório." }, { status: 400 });
  }

  try {
    let status = "active";

    if (subscriptionId) {
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        pause_collection: null,
      });
      status = subscription.status;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("condominios")
      .update({ status, access_note: null })
      .eq("id", condominioId);

    if (error) throw error;

    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error("admin/reactivate-subscription error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao reativar o condomínio." },
      { status: 500 }
    );
  }
}

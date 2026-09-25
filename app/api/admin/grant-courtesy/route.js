import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { getPlan } from "@/lib/plans";

// Platform-owner-only: grants free/complimentary access for testing or
// partnerships. Doesn't touch Stripe — this tenant simply isn't billed
// while status is "cortesia". `until` (optional) is an ISO date after
// which the admin should follow up (not auto-enforced).
export async function POST(request) {
  const auth = await requireAdmin(request, "condominios");
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { condominioId, planId, until, note } = await request.json();
  if (!condominioId) {
    return NextResponse.json({ error: "condominioId é obrigatório." }, { status: 400 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const update = {
      status: "cortesia",
      access_note: note || null,
      courtesy_until: until || null,
    };
    if (planId) {
      const plan = getPlan(planId);
      update.plano = plan.id;
      update.unidades_limite = plan.unitLimit;
    }

    const { error } = await supabaseAdmin
      .from("condominios")
      .update(update)
      .eq("id", condominioId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin/grant-courtesy error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao conceder cortesia." },
      { status: 500 }
    );
  }
}

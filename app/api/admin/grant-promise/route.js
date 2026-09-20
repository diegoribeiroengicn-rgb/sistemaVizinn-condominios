import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Platform-owner-only: manually unlocks access on trust — the tenant
// starts using the product before (or without) a working Stripe payment,
// e.g. while sorting out billing offline. Doesn't touch Stripe; the admin
// is expected to follow up and collect payment or cancel later.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { condominioId, note } = await request.json();
  if (!condominioId) {
    return NextResponse.json({ error: "condominioId é obrigatório." }, { status: 400 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("condominios")
      .update({ status: "promessa", access_note: note || null })
      .eq("id", condominioId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin/grant-promise error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao liberar acesso." },
      { status: 500 }
    );
  }
}

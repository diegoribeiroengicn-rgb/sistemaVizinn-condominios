import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Platform-owner-only: marca/desmarca o Pro+ Multicondomínios pro dono
// de um condomínio (identificado pelo owner_id daquele condomínio —
// o Pro+ é por dono, não por condomínio individual, mas a gente só
// tem o condominioId disponível no painel pra apontar qual dono).
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { condominioId, ativo } = await request.json();
  if (!condominioId || typeof ativo !== "boolean") {
    return NextResponse.json({ error: "condominioId e ativo são obrigatórios." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: condominio, error: condominioError } = await supabaseAdmin
    .from("condominios")
    .select("owner_id")
    .eq("id", condominioId)
    .single();
  if (condominioError) return NextResponse.json({ error: condominioError.message }, { status: 500 });

  const { error } = await supabaseAdmin.from("contas_sindico").upsert(
    {
      user_id: condominio.owner_id,
      pro_plus_multicondominios: ativo,
      pro_plus_desde: ativo ? new Date().toISOString() : null,
    },
    { onConflict: "user_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

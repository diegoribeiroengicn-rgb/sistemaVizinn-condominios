import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Platform-owner-only: marca/desmarca o Pro+ Multicondomínios pro dono
// de um condomínio (identificado pelo owner_id daquele condomínio —
// o Pro+ é por dono, não por condomínio individual, mas a gente só
// tem o condominioId disponível no painel pra apontar qual dono).
export async function POST(request) {
  const auth = await requireAdmin(request, "condominios");
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

  // 14 dias de teste grátis só na primeira vez que esse dono ativa o
  // Pro+ — se já tinha uma data de trial registrada (mesmo já
  // vencida), não reseta. Evita reativar o trial desligando e ligando
  // de novo.
  const { data: contaExistente } = await supabaseAdmin
    .from("contas_sindico")
    .select("pro_plus_trial_fim")
    .eq("user_id", condominio.owner_id)
    .maybeSingle();

  const trialFim =
    ativo && !contaExistente?.pro_plus_trial_fim
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : contaExistente?.pro_plus_trial_fim || null;

  const { error } = await supabaseAdmin.from("contas_sindico").upsert(
    {
      user_id: condominio.owner_id,
      pro_plus_multicondominios: ativo,
      pro_plus_desde: ativo ? new Date().toISOString() : null,
      pro_plus_trial_fim: trialFim,
    },
    { onConflict: "user_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

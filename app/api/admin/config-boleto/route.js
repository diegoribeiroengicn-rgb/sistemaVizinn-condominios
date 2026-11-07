import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Margem fixa que a AquiHabitto separa automaticamente (split no Asaas)
// de cada boleto pago, e a estimativa do custo que o próprio Asaas
// cobra (eles descontam sozinhos, a gente nunca vê o valor exato por
// cobrança) — juntas formam o "custo operacional total" que embasa o
// valor sugerido da tarifa de cobrança (ver lib/tarifaBoleto.js).
// Uma linha só na tabela — sempre lê/edita a primeira.
export async function GET(request) {
  const auth = await requireAdmin(request, "financeiro");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.from("config_boleto").select("*").limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    margemValor: data ? Number(data.margem_valor) : 0,
    custoAsaasEstimado: data ? Number(data.custo_asaas_estimado) : 0,
  });
}

export async function PATCH(request) {
  const auth = await requireAdmin(request, "financeiro");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { margemValor, custoAsaasEstimado } = await request.json().catch(() => ({}));
  if (margemValor == null && custoAsaasEstimado == null) {
    return NextResponse.json({ error: "Informe margemValor ou custoAsaasEstimado." }, { status: 400 });
  }
  if (margemValor != null && (!Number.isFinite(Number(margemValor)) || Number(margemValor) < 0)) {
    return NextResponse.json({ error: "Margem inválida." }, { status: 400 });
  }
  if (custoAsaasEstimado != null && (!Number.isFinite(Number(custoAsaasEstimado)) || Number(custoAsaasEstimado) < 0)) {
    return NextResponse.json({ error: "Custo do Asaas inválido." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: existente, error: selectError } = await supabaseAdmin.from("config_boleto").select("id").limit(1).maybeSingle();
  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });

  const patch = { updated_at: new Date().toISOString() };
  if (margemValor != null) patch.margem_valor = Number(margemValor);
  if (custoAsaasEstimado != null) patch.custo_asaas_estimado = Number(custoAsaasEstimado);

  const { error } = existente
    ? await supabaseAdmin.from("config_boleto").update(patch).eq("id", existente.id)
    : await supabaseAdmin.from("config_boleto").insert(patch);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

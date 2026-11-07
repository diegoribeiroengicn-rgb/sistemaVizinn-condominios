import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Margem fixa que a AquiHabitto separa automaticamente (split no Asaas)
// de cada boleto pago. Uma linha só na tabela — sempre lê/edita a
// primeira.
export async function GET(request) {
  const auth = await requireAdmin(request, "financeiro");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.from("config_boleto").select("*").limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ margemValor: data ? Number(data.margem_valor) : 0 });
}

export async function PATCH(request) {
  const auth = await requireAdmin(request, "financeiro");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { margemValor } = await request.json().catch(() => ({}));
  if (margemValor == null || !Number.isFinite(Number(margemValor)) || Number(margemValor) < 0) {
    return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: existente, error: selectError } = await supabaseAdmin.from("config_boleto").select("id").limit(1).maybeSingle();
  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });

  const { error } = existente
    ? await supabaseAdmin.from("config_boleto").update({ margem_valor: Number(margemValor), updated_at: new Date().toISOString() }).eq("id", existente.id)
    : await supabaseAdmin.from("config_boleto").insert({ margem_valor: Number(margemValor) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Pública — o dashboard Multicondomínios do síndico e a página de
// vendas precisam mostrar a mensalidade estimada sem exigir login de
// admin. Mesma regra de /api/public/taxas-adesao: edição fica
// trancada em /admin/pagamentos, leitura é aberta.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("multicondominios_faixas")
    .select("equivalentes_min, equivalentes_max, mensalidade, ordem")
    .eq("ativo", true)
    .order("ordem");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ faixas: data || [] });
}

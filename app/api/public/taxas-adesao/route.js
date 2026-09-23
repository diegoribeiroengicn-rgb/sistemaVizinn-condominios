import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Pública — o formulário de cadastro precisa saber o valor atual da
// taxa de adesão de cada plano (editável em /admin/pagamentos) antes
// de pedir pagamento.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.from("taxas_adesao").select("plano_id, valor");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const taxas = {};
  for (const t of data || []) taxas[t.plano_id] = Number(t.valor);
  return NextResponse.json({ taxas });
}

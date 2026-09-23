import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Lista vendedores já com o total vendido e comissão calculada
// (soma da taxa_adesao_paga de todo condomínio que entrou usando um
// cupom desse vendedor, × comissao_percentual quando definida).
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const [{ data: vendedores, error: vendedoresError }, { data: cupons }, { data: condominios }] = await Promise.all([
    supabaseAdmin.from("vendedores").select("*").order("nome"),
    supabaseAdmin.from("cupons").select("id, vendedor_id"),
    supabaseAdmin.from("condominios").select("cupom_id, taxa_adesao_paga").not("cupom_id", "is", null),
  ]);
  if (vendedoresError) return NextResponse.json({ error: vendedoresError.message }, { status: 500 });

  const cupomParaVendedor = {};
  for (const c of cupons || []) cupomParaVendedor[c.id] = c.vendedor_id;

  const totaisPorVendedor = {};
  for (const c of condominios || []) {
    const vendedorId = cupomParaVendedor[c.cupom_id];
    if (!vendedorId) continue;
    if (!totaisPorVendedor[vendedorId]) totaisPorVendedor[vendedorId] = { vendas: 0, totalAdesao: 0 };
    totaisPorVendedor[vendedorId].vendas += 1;
    totaisPorVendedor[vendedorId].totalAdesao += Number(c.taxa_adesao_paga) || 0;
  }

  const resultado = (vendedores || []).map((v) => {
    const totais = totaisPorVendedor[v.id] || { vendas: 0, totalAdesao: 0 };
    const comissao = v.comissao_percentual ? (totais.totalAdesao * Number(v.comissao_percentual)) / 100 : null;
    return { ...v, vendas: totais.vendas, total_adesao_gerado: totais.totalAdesao, comissao_a_receber: comissao };
  });

  return NextResponse.json({ vendedores: resultado });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { nome, email, telefone, comissaoPercentual } = await request.json();
  if (!nome?.trim()) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("vendedores")
    .insert({
      nome: nome.trim(),
      email: email || null,
      telefone: telefone || null,
      comissao_percentual: comissaoPercentual || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendedor: data });
}

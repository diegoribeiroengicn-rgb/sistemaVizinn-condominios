import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// KPIs do Dashboard → Vendedores (seção 20 do projeto).
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde"); // ISO date opcional, filtra vendas/comissões do período

  const [{ data: vendedores, error: erroVendedores }, comissoesQuery, vendasQuery] = await Promise.all([
    supabaseAdmin.from("vendedores").select("id, ativo, lider_atual_id, data_emancipacao"),
    (() => {
      let q = supabaseAdmin.from("comissoes").select("valor, status, tipo, created_at");
      if (desde) q = q.gte("created_at", desde);
      return q;
    })(),
    (() => {
      let q = supabaseAdmin.from("condominios").select("id, taxa_adesao_paga, vendedor_id, created_at").not("vendedor_id", "is", null);
      if (desde) q = q.gte("created_at", desde);
      return q;
    })(),
  ]);
  if (erroVendedores) return NextResponse.json({ error: erroVendedores.message }, { status: 500 });

  const { data: comissoes, error: erroComissoes } = await comissoesQuery;
  if (erroComissoes) return NextResponse.json({ error: erroComissoes.message }, { status: 500 });
  const { data: vendas, error: erroVendas } = await vendasQuery;
  if (erroVendas) return NextResponse.json({ error: erroVendas.message }, { status: 500 });

  const totalVendedores = (vendedores || []).length;
  const vendedoresAtivos = (vendedores || []).filter((v) => v.ativo).length;
  const vendedoresInativos = totalVendedores - vendedoresAtivos;
  const liderIds = new Set();
  for (const v of vendedores || []) if (v.lider_atual_id) liderIds.add(v.lider_atual_id);
  const emFormacao = (vendedores || []).filter((v) => v.lider_atual_id && !v.data_emancipacao).length;
  const emancipados = (vendedores || []).filter((v) => v.data_emancipacao).length;

  const valorTotalAdesoes = (vendas || []).reduce((s, v) => s + (Number(v.taxa_adesao_paga) || 0), 0);
  const totalRetidoVizinn = valorTotalAdesoes - (comissoes || [])
    .filter((c) => c.status !== "cancelada")
    .reduce((s, c) => s + (Number(c.valor) || 0), 0);

  let comissoesGeradas = 0, comissoesPendentes = 0, comissoesPagas = 0;
  for (const c of comissoes || []) {
    if (c.status === "cancelada") continue;
    comissoesGeradas += Number(c.valor) || 0;
    if (c.status === "paga") comissoesPagas += Number(c.valor) || 0;
    else comissoesPendentes += Number(c.valor) || 0;
  }

  return NextResponse.json({
    totalVendedores,
    vendedoresAtivos,
    vendedoresInativos,
    vendasNoPeriodo: (vendas || []).length,
    valorTotalAdesoes,
    comissoesGeradas,
    comissoesPendentes,
    comissoesPagas,
    valorRetidoVizinn: Math.max(0, totalRetidoVizinn),
    quantidadeLideres: liderIds.size,
    vendedoresEmFormacao: emFormacao,
    vendedoresEmancipados: emancipados,
  });
}

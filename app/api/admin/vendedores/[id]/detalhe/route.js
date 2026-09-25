import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { competenciaDeData, verificarElegibilidadeLideranca } from "@/lib/comissoes";

// Detalhamento completo de um vendedor (seção 22 do projeto): dados,
// vendas, comissões por tipo, equipe direta com situação de cada um, e
// o painel de progresso de liderança pro mês atual (seção 23).
export async function GET(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: vendedor, error: erroVendedor } = await supabaseAdmin
    .from("vendedores")
    .select("*, indicador:indicador_original_id(id, nome), lider:lider_atual_id(id, nome), modelo:modelo_comissionamento_id(*)")
    .eq("id", params.id)
    .maybeSingle();
  if (erroVendedor) return NextResponse.json({ error: erroVendedor.message }, { status: 500 });
  if (!vendedor) return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });

  const competenciaAtual = competenciaDeData(new Date());

  const [{ data: vendas, error: erroVendas }, { data: comissoes, error: erroComissoes }, { data: diretos, error: erroDiretos }] =
    await Promise.all([
      supabaseAdmin
        .from("condominios")
        .select("id, nome, taxa_adesao_paga, created_at, status")
        .eq("vendedor_id", params.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("comissoes")
        .select("*")
        .or(`vendedor_beneficiario_id.eq.${params.id},vendedor_venda_id.eq.${params.id}`)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("vendedores")
        .select("id, nome, ativo, status_cadastro")
        .eq("lider_atual_id", params.id),
    ]);
  if (erroVendas) return NextResponse.json({ error: erroVendas.message }, { status: 500 });
  if (erroComissoes) return NextResponse.json({ error: erroComissoes.message }, { status: 500 });
  if (erroDiretos) return NextResponse.json({ error: erroDiretos.message }, { status: 500 });

  const inicioMes = `${competenciaAtual}-01`;
  const vendasDoMes = (vendas || []).filter((v) => v.created_at >= inicioMes);

  const comissoesDoVendedor = (comissoes || []).filter((c) => c.vendedor_beneficiario_id === params.id && c.status !== "cancelada");
  const totaisComissao = { venda_propria: 0, indicacao_primeira_venda: 0, lideranca: 0, total: 0, paga: 0, pendente: 0 };
  for (const c of comissoesDoVendedor) {
    totaisComissao[c.tipo] += Number(c.valor) || 0;
    totaisComissao.total += Number(c.valor) || 0;
    if (c.status === "paga") totaisComissao.paga += Number(c.valor) || 0;
    else totaisComissao.pendente += Number(c.valor) || 0;
  }

  // Vendas do mês de cada direto, pra montar a equipe + o painel de
  // progresso, usando a mesma contagem que o motor de elegibilidade usa.
  const metaEquipe = vendedor.modelo?.meta_minima_equipe ?? 3;
  const equipe = await Promise.all(
    (diretos || []).map(async (d) => {
      const { count } = await supabaseAdmin
        .from("condominios")
        .select("id", { count: "exact", head: true })
        .eq("vendedor_id", d.id)
        .gte("created_at", inicioMes);
      return { ...d, vendas_mes: count || 0 };
    })
  );

  const comMeta = equipe.filter((e) => e.vendas_mes >= metaEquipe).length;
  const com1ou2 = equipe.filter((e) => e.vendas_mes >= 1 && e.vendas_mes < metaEquipe).length;
  const semVenda = equipe.filter((e) => e.vendas_mes === 0).length;

  let situacaoLideranca = null;
  if (vendedor.modelo?.permite_lideranca) {
    situacaoLideranca = await verificarElegibilidadeLideranca(supabaseAdmin, params.id, competenciaAtual, vendedor.modelo);
  }

  const totalDiretos = equipe.length;
  const limitePequena = vendedor.modelo?.limite_equipe_pequena ?? 8;
  const percentualGrande = vendedor.modelo?.percentual_equipe_grande ?? 80;
  const necessariosComMeta = totalDiretos <= limitePequena ? totalDiretos : Math.ceil(totalDiretos * (percentualGrande / 100));

  return NextResponse.json({
    vendedor: {
      ...vendedor,
      indicador_nome: vendedor.indicador?.nome || null,
      lider_nome: vendedor.lider?.nome || null,
    },
    vendas: {
      quantidade: (vendas || []).length,
      valorTotal: (vendas || []).reduce((s, v) => s + (Number(v.taxa_adesao_paga) || 0), 0),
      vendasDoMes: vendasDoMes.length,
      historico: vendas || [],
    },
    comissoes: {
      vendaPropria: totaisComissao.venda_propria,
      indicacao: totaisComissao.indicacao_primeira_venda,
      lideranca: totaisComissao.lideranca,
      total: totaisComissao.total,
      pago: totaisComissao.paga,
      pendente: totaisComissao.pendente,
      historico: comissoes || [],
    },
    equipe: {
      indicadorOriginal: vendedor.indicador?.nome || null,
      liderAtual: vendedor.lider?.nome || null,
      diretos: equipe,
      totalDiretos,
      comMeta,
      com1ou2,
      semVenda,
    },
    painelProgresso: {
      competencia: competenciaAtual,
      minhasVendas: vendasDoMes.length,
      metaLider: vendedor.modelo?.meta_minima_lider ?? 3,
      totalDiretos,
      necessariosComMeta,
      atualmenteComMeta: comMeta,
      restantes: Math.max(0, necessariosComMeta - comMeta),
      situacao: situacaoLideranca,
    },
  });
}

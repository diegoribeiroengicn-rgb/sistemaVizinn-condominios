import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";
import { gerarCodigoIndicacao } from "@/lib/comissoes";

// Lista vendedores com totais reais, vindos da tabela `comissoes` (não
// mais um cálculo em runtime só sobre taxa_adesao_paga × percentual
// único) — cobre venda própria, indicação e liderança separadamente.
export async function GET(request) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const [{ data: vendedores, error: vendedoresError }, { data: comissoes, error: comissoesError }, { data: vendas }] =
    await Promise.all([
      supabaseAdmin.from("vendedores").select("*, modelos_comissionamento(nome)").order("nome"),
      supabaseAdmin.from("comissoes").select("vendedor_beneficiario_id, tipo, valor, status"),
      supabaseAdmin.from("condominios").select("vendedor_id").not("vendedor_id", "is", null),
    ]);
  if (vendedoresError) return NextResponse.json({ error: vendedoresError.message }, { status: 500 });
  if (comissoesError) return NextResponse.json({ error: comissoesError.message }, { status: 500 });

  const vendasPorVendedor = {};
  for (const v of vendas || []) vendasPorVendedor[v.vendedor_id] = (vendasPorVendedor[v.vendedor_id] || 0) + 1;

  const totaisPorVendedor = {};
  for (const c of comissoes || []) {
    const t = (totaisPorVendedor[c.vendedor_beneficiario_id] ||= {
      total: 0,
      pendente: 0,
      paga: 0,
      venda_propria: 0,
      indicacao_primeira_venda: 0,
      lideranca: 0,
    });
    if (c.status !== "cancelada") {
      t.total += Number(c.valor) || 0;
      t[c.tipo] += Number(c.valor) || 0;
      if (c.status === "paga") t.paga += Number(c.valor) || 0;
      else t.pendente += Number(c.valor) || 0;
    }
  }

  const resultado = (vendedores || []).map((v) => {
    const totais = totaisPorVendedor[v.id] || {
      total: 0, pendente: 0, paga: 0, venda_propria: 0, indicacao_primeira_venda: 0, lideranca: 0,
    };
    return {
      ...v,
      modelo_nome: v.modelos_comissionamento?.nome || null,
      modelos_comissionamento: undefined,
      vendas: vendasPorVendedor[v.id] || 0,
      comissao_total: totais.total,
      comissao_pendente: totais.pendente,
      comissao_paga: totais.paga,
      comissao_venda_propria: totais.venda_propria,
      comissao_indicacao: totais.indicacao_primeira_venda,
      comissao_lideranca: totais.lideranca,
      emancipado: Boolean(v.data_emancipacao),
      em_formacao: !v.data_emancipacao && Boolean(v.lider_atual_id),
    };
  });

  return NextResponse.json({ vendedores: resultado });
}

export async function POST(request) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { nome, email, telefone, comissaoPercentual, indicadorOriginalId, liderAtualId, modeloComissionamentoId } =
    await request.json();
  if (!nome?.trim()) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();

  // Vendedor e funcionário do admin são papéis separados e nunca
  // podem ser a mesma pessoa (mesmo e-mail) — bloqueia aqui, antes de
  // criar o registro, em vez de deixar o conflito só aparecer depois
  // ao tentar liberar o acesso de login.
  if (email?.trim()) {
    const { data: funcionarioExistente } = await supabaseAdmin
      .from("admin_funcionarios").select("id").ilike("email", email.trim()).maybeSingle();
    if (funcionarioExistente) {
      return NextResponse.json(
        { error: "Esse e-mail já está cadastrado como funcionário do admin — não pode ser vendedor também." },
        { status: 409 }
      );
    }
  }

  let modeloId = modeloComissionamentoId || null;
  if (!modeloId) {
    const { data: padrao } = await supabaseAdmin
      .from("modelos_comissionamento").select("id").eq("padrao", true).maybeSingle();
    modeloId = padrao?.id || null;
  }

  // Gera um código de indicação único, com poucas tentativas em caso
  // de colisão (espaço de ~1 bilhão de combinações, colisão é raríssima).
  let codigo = null;
  for (let tentativa = 0; tentativa < 5 && !codigo; tentativa++) {
    const candidato = gerarCodigoIndicacao();
    const { data: existente } = await supabaseAdmin
      .from("vendedores").select("id").eq("codigo_indicacao", candidato).maybeSingle();
    if (!existente) codigo = candidato;
  }

  const { data, error } = await supabaseAdmin
    .from("vendedores")
    .insert({
      nome: nome.trim(),
      email: email || null,
      telefone: telefone || null,
      comissao_percentual: comissaoPercentual || null,
      indicador_original_id: indicadorOriginalId || null,
      lider_atual_id: liderAtualId || indicadorOriginalId || null,
      modelo_comissionamento_id: modeloId,
      codigo_indicacao: codigo,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "criar",
    entidade: "vendedor",
    entidadeId: data.id,
    dadosNovos: data,
  });

  return NextResponse.json({ vendedor: data });
}

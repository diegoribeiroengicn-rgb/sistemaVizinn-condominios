import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";

const CAMPOS_PERMITIDOS = {
  nome: "nome",
  email: "email",
  telefone: "telefone",
  comissaoPercentual: "comissao_percentual",
  ativo: "ativo",
  statusCadastro: "status_cadastro",
  liderAtualId: "lider_atual_id",
  modeloComissionamentoId: "modelo_comissionamento_id",
};

// Só o admin da plataforma altera vendedor — não existe login de
// vendedor no sistema hoje (ver relatório de arquitetura), então não
// há risco de o próprio vendedor mexer no seu percentual/regra.
export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const updates = {};
  for (const [chave, coluna] of Object.entries(CAMPOS_PERMITIDOS)) {
    if (chave in body) updates[coluna] = body[chave];
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: anterior } = await supabaseAdmin.from("vendedores").select("*").eq("id", params.id).maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("vendedores").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "editar",
    entidade: "vendedor",
    entidadeId: params.id,
    dadosAnteriores: anterior,
    dadosNovos: data,
  });

  return NextResponse.json({ success: true, vendedor: data });
}

// Só permite excluir de verdade um vendedor SEM histórico financeiro
// (nenhuma venda, nenhuma comissão — nem como beneficiário nem como
// quem vendeu). Com histórico, a exclusão apagaria comissão de OUTRO
// vendedor (ex: quem o indicou) ou perderia rastreabilidade de venda
// real — nesses casos a resposta pede pra desativar em vez de excluir
// (ver PATCH { ativo: false } acima).
export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: anterior, error: erroAnterior } = await supabaseAdmin
    .from("vendedores").select("*").eq("id", params.id).maybeSingle();
  if (erroAnterior) return NextResponse.json({ error: erroAnterior.message }, { status: 500 });
  if (!anterior) return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });

  const [{ count: qtdComissoesBeneficiario }, { count: qtdComissoesVenda }, { count: qtdVendas }] = await Promise.all([
    supabaseAdmin.from("comissoes").select("id", { count: "exact", head: true }).eq("vendedor_beneficiario_id", params.id),
    supabaseAdmin.from("comissoes").select("id", { count: "exact", head: true }).eq("vendedor_venda_id", params.id),
    supabaseAdmin.from("condominios").select("id", { count: "exact", head: true }).eq("vendedor_id", params.id),
  ]);
  const temHistorico = (qtdComissoesBeneficiario || 0) > 0 || (qtdComissoesVenda || 0) > 0 || (qtdVendas || 0) > 0;
  if (temHistorico) {
    return NextResponse.json(
      { error: "Esse vendedor tem vendas ou comissões registradas — não dá pra excluir sem perder rastreabilidade financeira (inclusive de outros vendedores, como quem o indicou). Desative em vez de excluir." },
      { status: 409 }
    );
  }

  // Sem histórico é seguro excluir de verdade. Se tinha acesso de
  // login, remove o auth.users também (senão fica um usuário fantasma
  // sem vendedor vinculado) — best-effort, não impede a exclusão do
  // registro se falhar.
  if (anterior.user_id) {
    const { error: erroAuth } = await supabaseAdmin.auth.admin.deleteUser(anterior.user_id);
    if (erroAuth) console.error("Erro ao remover login do vendedor excluído:", erroAuth);
  }

  const { error } = await supabaseAdmin.from("vendedores").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "excluir",
    entidade: "vendedor",
    entidadeId: params.id,
    dadosAnteriores: anterior,
  });

  return NextResponse.json({ success: true });
}

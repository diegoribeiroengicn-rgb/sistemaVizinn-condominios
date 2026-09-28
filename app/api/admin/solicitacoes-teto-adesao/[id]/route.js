import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";

// Aprovar ou rejeitar um pedido de aumento de teto. Aprovar não é só
// marcar status — é a própria ação que sobe taxas_adesao.teto do
// plano pro valor pedido (senão o vendedor fica "aprovado" e mesmo
// assim travado na próxima venda).
export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { status, respostaAdmin } = await request.json();
  if (!["aprovado", "rejeitado"].includes(status)) {
    return NextResponse.json({ error: "status precisa ser 'aprovado' ou 'rejeitado'." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: solicitacao, error: erroBusca } = await supabaseAdmin
    .from("solicitacoes_teto_adesao")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (erroBusca) return NextResponse.json({ error: erroBusca.message }, { status: 500 });
  if (!solicitacao) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  if (solicitacao.status !== "pendente") {
    return NextResponse.json({ error: "Essa solicitação já foi resolvida." }, { status: 409 });
  }

  if (status === "aprovado") {
    const { error: erroTeto } = await supabaseAdmin
      .from("taxas_adesao")
      .update({ teto: solicitacao.valor_solicitado, updated_at: new Date().toISOString() })
      .eq("plano_id", solicitacao.plano_id);
    if (erroTeto) return NextResponse.json({ error: erroTeto.message }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("solicitacoes_teto_adesao")
    .update({ status, resposta_admin: respostaAdmin?.trim() || null, resolvido_em: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: status === "aprovado" ? "aprovar" : "rejeitar",
    entidade: "solicitacao_teto_adesao",
    entidadeId: params.id,
    dadosAnteriores: solicitacao,
    dadosNovos: data,
  });

  return NextResponse.json({ success: true, solicitacao: data });
}

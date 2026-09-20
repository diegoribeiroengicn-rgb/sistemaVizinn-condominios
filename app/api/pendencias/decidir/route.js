import { NextResponse } from "next/server";
import { requireCondominioOwner } from "@/lib/memberAuth";
import { registrarAuditoria } from "@/lib/auditoria";
import { aplicarPendenciaMembro, descartarPendenciaMembro } from "@/lib/pendencias";

// Síndico-only: aprova ou rejeita uma pendência (por enquanto, só de
// Acessos/Permissões — criadas quando um subsíndico/administrador com
// requer_aprovacao=true tenta criar/editar/excluir um acesso).
export async function POST(request) {
  const body = await request.json();
  const { condominioId, pendenciaId, decisao, motivoRejeicao } = body;

  const auth = await requireCondominioOwner(request, condominioId);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!pendenciaId || !["aprovar", "rejeitar"].includes(decisao)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { supabaseAdmin, user } = auth;

  try {
    const { data: pendencia, error: fetchError } = await supabaseAdmin
      .from("pendencias")
      .select("*")
      .eq("id", pendenciaId)
      .eq("condominio_id", condominioId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!pendencia) {
      return NextResponse.json({ error: "Pendência não encontrada." }, { status: 404 });
    }
    if (pendencia.status !== "pendente") {
      return NextResponse.json({ error: "Esta pendência já foi decidida." }, { status: 409 });
    }

    if (decisao === "aprovar" && pendencia.tabela === "membros") {
      await aplicarPendenciaMembro(supabaseAdmin, pendencia);
    } else if (decisao === "rejeitar" && pendencia.tabela === "membros") {
      await descartarPendenciaMembro(supabaseAdmin, pendencia);
    }

    const novoStatus = decisao === "aprovar" ? "aprovada" : "rejeitada";
    const { error: updateError } = await supabaseAdmin
      .from("pendencias")
      .update({
        status: novoStatus,
        decidido_por_id: user.id,
        decidido_por_nome: user.user_metadata?.full_name || user.email,
        decidido_em: new Date().toISOString(),
        motivo_rejeicao: decisao === "rejeitar" ? motivoRejeicao || null : null,
      })
      .eq("id", pendenciaId);
    if (updateError) throw updateError;

    await registrarAuditoria(supabaseAdmin, {
      condominioId,
      usuarioId: user.id,
      usuarioNome: user.user_metadata?.full_name || user.email,
      papel: "sindico",
      acao: decisao === "aprovar" ? "aprovar" : "rejeitar",
      modulo: "acessos",
      registroId: pendencia.registro_id,
      dadosAnteriores: pendencia.dados_anteriores,
      dadosNovos: pendencia.dados_novos,
      status: novoStatus,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("pendencias/decidir error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível decidir a pendência." },
      { status: 500 }
    );
  }
}

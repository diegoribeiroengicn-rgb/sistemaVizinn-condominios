import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";

const STATUS_VALIDOS = ["pendente", "gerada", "aprovada", "paga", "cancelada"];

// Muda status de uma comissão (aprovar, marcar como paga, cancelar).
// Só usuário admin autorizado — sempre gera log de auditoria (seção
// 28/29/30 do projeto).
export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  if (body.status && !STATUS_VALIDOS.includes(body.status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: anterior, error: erroAnterior } = await supabaseAdmin
    .from("comissoes").select("*").eq("id", params.id).maybeSingle();
  if (erroAnterior) return NextResponse.json({ error: erroAnterior.message }, { status: 500 });
  if (!anterior) return NextResponse.json({ error: "Comissão não encontrada." }, { status: 404 });

  const updates = { updated_at: new Date().toISOString() };
  if (body.status) updates.status = body.status;
  if (body.observacao !== undefined) updates.observacao = body.observacao;
  if (body.referenciaPagamento !== undefined) updates.referencia_pagamento = body.referenciaPagamento;

  // Marcar como paga registra quem confirmou e quando (seção 29).
  if (body.status === "paga") {
    updates.pago_por = auth.user.id;
    updates.pago_em = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("comissoes").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: body.status ? `status_${body.status}` : "editar",
    entidade: "comissao",
    entidadeId: params.id,
    dadosAnteriores: anterior,
    dadosNovos: data,
    motivo: body.motivo || null,
  });

  return NextResponse.json({ comissao: data });
}

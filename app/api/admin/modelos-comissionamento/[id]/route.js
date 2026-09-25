import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";

const CAMPOS_PERMITIDOS = [
  "nome", "descricao", "percentual_venda_propria", "percentual_indicacao", "percentual_lideranca",
  "permite_indicacao", "permite_lideranca", "meta_minima_lider", "meta_minima_equipe",
  "limite_equipe_pequena", "percentual_equipe_grande", "meta_minima_secundaria", "permite_emancipacao",
  "status", "vigencia_inicio", "vigencia_fim",
];

// Campos que, se mudarem, afetam o CÁLCULO de comissões — qualquer
// alteração neles precisa incrementar a versão do modelo, pra que
// comissões já geradas (que guardam modelo_versao) nunca sejam
// recalculadas retroativamente. Editar só nome/descrição não bump a
// versão.
const CAMPOS_DE_REGRA = [
  "percentual_venda_propria", "percentual_indicacao", "percentual_lideranca",
  "permite_indicacao", "permite_lideranca", "meta_minima_lider", "meta_minima_equipe",
  "limite_equipe_pequena", "percentual_equipe_grande", "meta_minima_secundaria", "permite_emancipacao",
];

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const updates = {};
  for (const campo of CAMPOS_PERMITIDOS) {
    if (campo in body) updates[campo] = body[campo];
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: anterior, error: erroAnterior } = await supabaseAdmin
    .from("modelos_comissionamento").select("*").eq("id", params.id).maybeSingle();
  if (erroAnterior) return NextResponse.json({ error: erroAnterior.message }, { status: 500 });
  if (!anterior) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });

  const mudouRegra = CAMPOS_DE_REGRA.some((campo) => campo in updates && String(updates[campo]) !== String(anterior[campo]));
  if (mudouRegra) updates.versao = anterior.versao + 1;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("modelos_comissionamento").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "editar",
    entidade: "modelo_comissionamento",
    entidadeId: params.id,
    dadosAnteriores: anterior,
    dadosNovos: data,
    motivo: body.motivo || null,
  });

  return NextResponse.json({ modelo: data, versaoAlterada: mudouRegra });
}

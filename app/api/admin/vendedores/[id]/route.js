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
  const auth = await requireAdmin(request);
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

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: anterior } = await supabaseAdmin.from("vendedores").select("*").eq("id", params.id).maybeSingle();

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

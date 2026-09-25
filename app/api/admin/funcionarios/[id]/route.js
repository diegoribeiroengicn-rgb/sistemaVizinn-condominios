import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";
import { ADMIN_MODULO_IDS } from "@/lib/adminModulos";

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const updates = {};
  if ("nome" in body) updates.nome = body.nome;
  if ("ativo" in body) updates.ativo = body.ativo;
  if ("modulosPermitidos" in body) {
    updates.modulos_permitidos = (body.modulosPermitidos || []).filter((m) => ADMIN_MODULO_IDS.includes(m));
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  updates.updated_at = new Date().toISOString();

  const supabaseAdmin = getSupabaseAdmin();
  const { data: anterior } = await supabaseAdmin.from("admin_funcionarios").select("*").eq("id", params.id).maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("admin_funcionarios").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "editar",
    entidade: "admin_funcionario",
    entidadeId: params.id,
    dadosAnteriores: anterior,
    dadosNovos: data,
  });

  return NextResponse.json({ funcionario: data });
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: anterior } = await supabaseAdmin.from("admin_funcionarios").select("*").eq("id", params.id).maybeSingle();
  if (!anterior) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  if (anterior.user_id) {
    const { error: erroAuth } = await supabaseAdmin.auth.admin.deleteUser(anterior.user_id);
    if (erroAuth) console.error("Erro ao remover login do funcionário excluído:", erroAuth);
  }

  const { error } = await supabaseAdmin.from("admin_funcionarios").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "excluir",
    entidade: "admin_funcionario",
    entidadeId: params.id,
    dadosAnteriores: anterior,
  });

  return NextResponse.json({ success: true });
}

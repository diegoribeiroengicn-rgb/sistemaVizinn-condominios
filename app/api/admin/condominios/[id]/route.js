import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";

// Exclusão definitiva de um condomínio — pra limpar cadastros de
// teste/lixo (ex: signup abandonado no meio, dados digitados errado)
// sem precisar mexer direto no banco. Apaga o usuário do síndico no
// Supabase Auth, o que já cascateia (on delete cascade) pra apagar o
// condomínio e TUDO que depende dele (moradores, chamados,
// financeiro, comissões geradas pra essa venda, etc — ver
// supabase/schema.sql). Não tem como desfazer — bem mais destrutivo
// que "Cancelar assinatura" (que só muda o status).
export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request, "condominios");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: condominio, error: erroCondominio } = await supabaseAdmin
    .from("condominios").select("*").eq("id", params.id).maybeSingle();
  if (erroCondominio) return NextResponse.json({ error: erroCondominio.message }, { status: 500 });
  if (!condominio) return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 404 });

  if (condominio.owner_id) {
    const { error: erroAuth } = await supabaseAdmin.auth.admin.deleteUser(condominio.owner_id);
    // "user not found" pode acontecer se o usuário já tinha sido removido
    // antes por algum outro motivo — segue e apaga o condomínio mesmo assim.
    if (erroAuth && !erroAuth.message?.toLowerCase().includes("not found")) {
      return NextResponse.json({ error: erroAuth.message }, { status: 500 });
    }
  }

  // deleteUser acima já cascateia via condominios.owner_id — mas se o
  // condomínio não tinha owner_id (não deveria acontecer, coluna é
  // not null, mas por segurança) apaga direto aqui também.
  const { error: erroDelete } = await supabaseAdmin.from("condominios").delete().eq("id", params.id);
  if (erroDelete) return NextResponse.json({ error: erroDelete.message }, { status: 500 });

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "excluir",
    entidade: "condominio",
    entidadeId: params.id,
    dadosAnteriores: condominio,
  });

  return NextResponse.json({ success: true });
}

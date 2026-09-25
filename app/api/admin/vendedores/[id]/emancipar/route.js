import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";
import { emanciparVendedor } from "@/lib/comissoes";

// Carrossel/emancipação (regras 15-17): o vendedor deixa de estar sob
// o líder atual e passa a ser líder independente. Não apaga
// indicador_original_id (histórico permanece) nem comissões já
// geradas — só fecha o vínculo de liderança atual e registra a data.
export async function POST(request, { params }) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: anterior } = await supabaseAdmin.from("vendedores").select("*").eq("id", params.id).maybeSingle();
  if (!anterior) return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });
  if (!anterior.lider_atual_id) {
    return NextResponse.json({ error: "Esse vendedor já não tem líder atual (já é independente)." }, { status: 400 });
  }

  const { motivo } = await request.json().catch(() => ({}));
  const atualizado = await emanciparVendedor(supabaseAdmin, params.id);

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "emancipar",
    entidade: "vendedor",
    entidadeId: params.id,
    dadosAnteriores: { lider_atual_id: anterior.lider_atual_id },
    dadosNovos: { lider_atual_id: null, data_emancipacao: atualizado.data_emancipacao },
    motivo: motivo || null,
  });

  return NextResponse.json({ success: true, vendedor: atualizado });
}

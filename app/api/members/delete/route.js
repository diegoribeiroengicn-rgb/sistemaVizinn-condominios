import { NextResponse } from "next/server";
import { requireCondominioAccess } from "@/lib/memberAuth";
import { registrarAuditoria } from "@/lib/auditoria";

// Revokes a delimited-access account entirely (removes the membros row
// and deletes the underlying Supabase login). O síndico sempre aplica na
// hora; um subsíndico/administrador com requer_aprovacao ligado tem a
// exclusão enfileirada em pendencias até o síndico aprovar.
export async function POST(request) {
  const body = await request.json();
  const { condominioId, memberId, userId } = body;

  const auth = await requireCondominioAccess(request, condominioId, "acessos", "excluir");
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!memberId || !userId) {
    return NextResponse.json({ error: "memberId e userId são obrigatórios." }, { status: 400 });
  }

  const { supabaseAdmin, isOwner, membro, user } = auth;
  const precisaAprovacao = !isOwner && membro?.requer_aprovacao;

  try {
    const { data: alvoAtual, error: fetchError } = await supabaseAdmin
      .from("membros")
      .select("*")
      .eq("id", memberId)
      .eq("condominio_id", condominioId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!alvoAtual) {
      return NextResponse.json({ error: "Acesso não encontrado neste condomínio." }, { status: 404 });
    }

    if (precisaAprovacao) {
      const { error: pendenciaError } = await supabaseAdmin.from("pendencias").insert({
        condominio_id: condominioId,
        solicitante_id: user.id,
        solicitante_nome: membro.nome,
        acao: "excluir",
        tabela: "membros",
        registro_id: memberId,
        dados_anteriores: alvoAtual,
        dados_novos: {},
      });
      if (pendenciaError) throw pendenciaError;

      return NextResponse.json({ success: true, pending: true });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("membros")
      .delete()
      .eq("id", memberId)
      .eq("condominio_id", condominioId);
    if (deleteError) throw deleteError;

    await supabaseAdmin.auth.admin.deleteUser(userId).catch((err) => {
      console.error("Erro ao remover login do membro:", err);
    });

    await registrarAuditoria(supabaseAdmin, {
      condominioId,
      usuarioId: user.id,
      usuarioNome: isOwner ? user.user_metadata?.full_name || user.email : membro.nome,
      papel: isOwner ? "sindico" : membro.papel,
      acao: "excluir",
      modulo: "acessos",
      registroId: memberId,
      dadosAnteriores: alvoAtual,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("members/delete error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível remover o acesso." },
      { status: 500 }
    );
  }
}

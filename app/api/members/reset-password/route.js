import { NextResponse } from "next/server";
import { requireCondominioAccess } from "@/lib/memberAuth";
import { registrarAuditoria } from "@/lib/auditoria";

// Sets a new temporary password for a member who lost theirs. Verifies
// the membro really belongs to this condominio before touching their
// auth account. Reaproveita a permissão de "editar" em "acessos" — mas,
// diferente de criar/editar/excluir, redefinir senha não entra na fila de
// pendências (não dá pra "revisar" uma senha antes de aprovar), então um
// delegado só pode fazer isso quando está liberado sem aprovação
// (requer_aprovacao=false).
export async function POST(request) {
  const body = await request.json();
  const { condominioId, memberId, userId, newPassword } = body;

  const auth = await requireCondominioAccess(request, condominioId, "acessos", "editar");
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!memberId || !userId || !newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { error: "Dados inválidos (senha deve ter ao menos 6 caracteres)." },
      { status: 400 }
    );
  }

  const { supabaseAdmin, isOwner, membro, user } = auth;
  if (!isOwner && membro?.requer_aprovacao) {
    return NextResponse.json(
      {
        error:
          "Redefinir senha exige liberação total do síndico (sem aprovação pendente) — peça pra ele fazer isso ou te liberar em Acessos.",
      },
      { status: 403 }
    );
  }

  try {
    const { data: alvoAtual, error: membroError } = await supabaseAdmin
      .from("membros")
      .select("id, nome")
      .eq("id", memberId)
      .eq("condominio_id", condominioId)
      .maybeSingle();

    if (membroError) throw membroError;
    if (!alvoAtual) {
      return NextResponse.json(
        { error: "Acesso não encontrado neste condomínio." },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updateError) throw updateError;

    await registrarAuditoria(supabaseAdmin, {
      condominioId,
      usuarioId: user.id,
      usuarioNome: isOwner ? user.user_metadata?.full_name || user.email : membro.nome,
      papel: isOwner ? "sindico" : membro.papel,
      acao: "editar",
      modulo: "acessos",
      registroId: memberId,
      dadosNovos: { acao: "redefinir_senha", alvo: alvoAtual.nome },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("members/reset-password error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível redefinir a senha." },
      { status: 500 }
    );
  }
}

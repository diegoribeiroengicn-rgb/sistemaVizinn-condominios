import { NextResponse } from "next/server";
import { requireCondominioAccess } from "@/lib/memberAuth";
import { registrarAuditoria } from "@/lib/auditoria";
import { papelPodeRequererAprovacao, sanitizePermissoes } from "@/lib/permissoes";

const VALID_PAPEIS = new Set([
  "condomino",
  "porteiro",
  "conselheiro",
  "zelador",
  "subsindico",
  "administrador",
]);

// Edits an existing member's papel/unidade/telefone/nome and quais
// permissões (módulo → ações) ele tem — o síndico sempre aplica na hora;
// um subsíndico/administrador com requer_aprovacao ligado tem a edição
// enfileirada em pendencias até o síndico aprovar. Does not touch the
// login (e-mail/senha); see /api/members/reset-password for that.
export async function POST(request) {
  const body = await request.json();
  const { condominioId, memberId, nome, telefone, papel, unidade, permissoes, requerAprovacao } = body;

  const auth = await requireCondominioAccess(request, condominioId, "acessos", "editar");
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!memberId || !nome || !VALID_PAPEIS.has(papel)) {
    return NextResponse.json(
      { error: "Dados obrigatórios ausentes ou papel inválido." },
      { status: 400 }
    );
  }

  const permissoesValidas = sanitizePermissoes(permissoes);
  const requerAprovacaoValido = papelPodeRequererAprovacao(papel) ? Boolean(requerAprovacao) : false;

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

    const dadosNovos = {
      nome,
      telefone: telefone || null,
      papel,
      unidade: unidade || null,
      permissoes: permissoesValidas,
      requerAprovacao: requerAprovacaoValido,
    };

    if (precisaAprovacao) {
      const { error: pendenciaError } = await supabaseAdmin.from("pendencias").insert({
        condominio_id: condominioId,
        solicitante_id: user.id,
        solicitante_nome: membro.nome,
        acao: "editar",
        tabela: "membros",
        registro_id: memberId,
        dados_anteriores: alvoAtual,
        dados_novos: dadosNovos,
      });
      if (pendenciaError) throw pendenciaError;

      return NextResponse.json({ success: true, pending: true });
    }

    const { error } = await supabaseAdmin
      .from("membros")
      .update({
        nome,
        telefone: telefone || null,
        papel,
        unidade: unidade || null,
        permissoes: permissoesValidas,
        requer_aprovacao: requerAprovacaoValido,
      })
      .eq("id", memberId)
      .eq("condominio_id", condominioId);

    if (error) throw error;

    await registrarAuditoria(supabaseAdmin, {
      condominioId,
      usuarioId: user.id,
      usuarioNome: isOwner ? user.user_metadata?.full_name || user.email : membro.nome,
      papel: isOwner ? "sindico" : membro.papel,
      acao: "editar",
      modulo: "acessos",
      registroId: memberId,
      dadosAnteriores: alvoAtual,
      dadosNovos,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("members/update error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível editar o acesso." },
      { status: 500 }
    );
  }
}

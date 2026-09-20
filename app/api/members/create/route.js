import { NextResponse } from "next/server";
import { requireCondominioAccess } from "@/lib/memberAuth";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  DEFAULT_PERMISSOES_BY_PAPEL,
  papelPodeRequererAprovacao,
  sanitizePermissoes,
} from "@/lib/permissoes";

const VALID_PAPEIS = new Set([
  "condomino",
  "porteiro",
  "conselheiro",
  "zelador",
  "subsindico",
  "administrador",
]);

// Creates a delimited-access account — a real Supabase login the
// síndico (ou um subsíndico/administrador com permissão de "criar" em
// "acessos") hands to that person, scoped by Row Level Security às
// permissões concedidas (ver membros.permissoes / membro_tem_permissao()
// no banco).
//
// Quando quem cria é um delegado (não o síndico) com requer_aprovacao
// ligado, a conta de login já é criada (não dá pra guardar senha em texto
// puro numa fila de pendência), mas o acesso em si (a linha em membros)
// só é criado quando o síndico aprovar — até lá esse login não enxerga
// nada, porque não existe conteúdo em `membros` pra RLS liberar.
export async function POST(request) {
  const body = await request.json();
  const { condominioId, nome, email, telefone, password, papel, unidade, bloco, permissoes, requerAprovacao } =
    body;

  const auth = await requireCondominioAccess(request, condominioId, "acessos", "criar");
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!nome || !password || !VALID_PAPEIS.has(papel)) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes ou papel inválido." }, { status: 400 });
  }
  if (!email && !telefone) {
    return NextResponse.json(
      { error: "Informe pelo menos um telefone ou e-mail." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });
  }

  const permissoesValidas =
    permissoes && typeof permissoes === "object"
      ? sanitizePermissoes(permissoes)
      : DEFAULT_PERMISSOES_BY_PAPEL[papel] || {};

  const requerAprovacaoValido = papelPodeRequererAprovacao(papel)
    ? requerAprovacao === undefined
      ? true
      : Boolean(requerAprovacao)
    : false;

  const { supabaseAdmin, isOwner, membro, user } = auth;
  const precisaAprovacao = !isOwner && membro?.requer_aprovacao;

  // O login é sempre baseado em e-mail (sem SMS/telefone configurado), com
  // um placeholder gerado a partir do telefone quando não informado.
  const loginEmail = email || `tel-${telefone.replace(/\D/g, "")}@membro.vizinn.local`;

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome, papel, telefone: telefone || null },
    });

    if (userError) {
      if (userError.message?.toLowerCase().includes("already")) {
        return NextResponse.json({ error: "Já existe uma conta com este e-mail/telefone." }, { status: 409 });
      }
      throw userError;
    }

    if (precisaAprovacao) {
      const { error: pendenciaError } = await supabaseAdmin.from("pendencias").insert({
        condominio_id: condominioId,
        solicitante_id: user.id,
        solicitante_nome: membro.nome,
        acao: "criar",
        tabela: "membros",
        registro_id: null,
        dados_anteriores: null,
        dados_novos: {
          userId: userData.user.id,
          nome,
          email: loginEmail,
          telefone: telefone || null,
          papel,
          unidade: unidade || null,
          bloco: bloco || null,
          permissoes: permissoesValidas,
          requerAprovacao: requerAprovacaoValido,
        },
      });
      if (pendenciaError) {
        await supabaseAdmin.auth.admin.deleteUser(userData.user.id).catch(() => {});
        throw pendenciaError;
      }

      return NextResponse.json({ success: true, pending: true, loginEmail });
    }

    const { error: memberError } = await supabaseAdmin.from("membros").insert({
      condominio_id: condominioId,
      user_id: userData.user.id,
      nome,
      email: loginEmail,
      telefone: telefone || null,
      papel,
      unidade: unidade || null,
      bloco: bloco || null,
      permissoes: permissoesValidas,
      requer_aprovacao: requerAprovacaoValido,
    });

    if (memberError) {
      // Roll back the orphaned auth user so a failed insert doesn't leave
      // a login with no membro row (and no way to log in usefully).
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id).catch(() => {});
      throw memberError;
    }

    await registrarAuditoria(supabaseAdmin, {
      condominioId,
      usuarioId: user.id,
      usuarioNome: isOwner ? user.user_metadata?.full_name || user.email : membro.nome,
      papel: isOwner ? "sindico" : membro.papel,
      acao: "criar",
      modulo: "acessos",
      registroId: userData.user.id,
      dadosNovos: { nome, email: loginEmail, telefone, papel, unidade, bloco, permissoes: permissoesValidas },
    });

    return NextResponse.json({ success: true, loginEmail });
  } catch (err) {
    console.error("members/create error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível criar o acesso." },
      { status: 500 }
    );
  }
}

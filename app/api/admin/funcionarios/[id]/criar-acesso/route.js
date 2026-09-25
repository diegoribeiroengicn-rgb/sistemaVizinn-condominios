import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";
import { enviarEmail } from "@/lib/notificacoes";

// Mesmo padrão de /api/admin/vendedores/[id]/criar-acesso: cria o
// usuário (ou reaproveita se já existir), salva o vínculo antes de
// qualquer etapa que possa falhar, gera link de definir senha e manda
// por e-mail.
export async function POST(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: funcionario, error: erroFuncionario } = await supabaseAdmin
    .from("admin_funcionarios").select("*").eq("id", params.id).maybeSingle();
  if (erroFuncionario) return NextResponse.json({ error: erroFuncionario.message }, { status: 500 });
  if (!funcionario) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  let userId = funcionario.user_id;

  if (!userId) {
    const { data: userData, error: erroCriarUser } = await supabaseAdmin.auth.admin.createUser({
      email: funcionario.email,
      password: randomUUID(),
      email_confirm: true,
      user_metadata: { tipo: "admin_funcionario", funcionario_id: funcionario.id, nome: funcionario.nome },
    });
    if (erroCriarUser) {
      if (erroCriarUser.message?.toLowerCase().includes("already")) {
        return NextResponse.json({ error: "Já existe uma conta com este e-mail no Vizinn." }, { status: 409 });
      }
      return NextResponse.json({ error: erroCriarUser.message }, { status: 500 });
    }
    userId = userData.user.id;
  }

  const { data: atualizado, error: erroUpdate } = await supabaseAdmin
    .from("admin_funcionarios")
    .update({ user_id: userId, ativo: true })
    .eq("id", params.id)
    .select()
    .single();
  if (erroUpdate) return NextResponse.json({ error: erroUpdate.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  const { data: linkData, error: erroLink } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: funcionario.email,
    options: { redirectTo: `${origin}/redefinir-senha` },
  });
  if (erroLink) {
    return NextResponse.json(
      { error: `Acesso criado, mas não consegui gerar o link de senha: ${erroLink.message}. Tente de novo.` },
      { status: 500 }
    );
  }

  try {
    await enviarEmail({
      to: funcionario.email,
      subject: "Seu acesso ao painel Vizinn",
      fromName: "Vizinn",
      html: `
        <p>Olá, ${funcionario.nome}!</p>
        <p>Seu acesso ao painel administrativo da Vizinn foi liberado. Clique no link abaixo pra criar sua senha e entrar:</p>
        <p><a href="${linkData.properties.action_link}">Criar minha senha e acessar</a></p>
      `,
    });
  } catch (erroEmail) {
    console.error("Erro ao enviar e-mail de acesso ao funcionário:", erroEmail);
  }

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "criar_acesso",
    entidade: "admin_funcionario",
    entidadeId: params.id,
    dadosNovos: { user_id: userId },
  });

  // Devolve o link também na resposta (não só por e-mail) — se o
  // e-mail falhar ou atrasar, o dono ainda pode copiar e mandar na mão.
  return NextResponse.json({ success: true, funcionario: atualizado, actionLink: linkData.properties.action_link });
}

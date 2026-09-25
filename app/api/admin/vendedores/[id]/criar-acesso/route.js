import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";
import { enviarEmail } from "@/lib/notificacoes";

// Gera o acesso de login pro vendedor (seção "área de acesso de
// vendedor"): cria o usuário no Supabase Auth, vincula em
// vendedores.user_id, e manda um e-mail (via Resend, igual todo o
// resto do sistema) com um link de definir senha. Também aprova o
// cadastro (ativo=true, status_cadastro=ativo) — conceder acesso É a
// aprovação, pra quem se cadastrou pelo link de convite.
export async function POST(request, { params }) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: vendedor, error: erroVendedor } = await supabaseAdmin
    .from("vendedores").select("*").eq("id", params.id).maybeSingle();
  if (erroVendedor) return NextResponse.json({ error: erroVendedor.message }, { status: 500 });
  if (!vendedor) return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });
  if (!vendedor.email) return NextResponse.json({ error: "Esse vendedor não tem e-mail cadastrado." }, { status: 400 });

  let userId = vendedor.user_id;

  if (!userId) {
    const senhaTemporaria = randomUUID();
    const { data: userData, error: erroCriarUser } = await supabaseAdmin.auth.admin.createUser({
      email: vendedor.email,
      password: senhaTemporaria,
      email_confirm: true,
      user_metadata: { tipo: "vendedor", vendedor_id: vendedor.id, nome: vendedor.nome },
    });
    if (erroCriarUser) {
      if (erroCriarUser.message?.toLowerCase().includes("already")) {
        return NextResponse.json({ error: "Já existe uma conta com este e-mail no Vizinn." }, { status: 409 });
      }
      return NextResponse.json({ error: erroCriarUser.message }, { status: 500 });
    }
    userId = userData.user.id;
  }

  // Salva o vínculo já aqui, antes de qualquer etapa que possa falhar
  // (link, e-mail) — se algo adiante der erro, o usuário já criado não
  // fica "órfão" e uma nova tentativa reaproveita o mesmo user_id em
  // vez de tentar criar outro e falhar com "já existe".
  const { data: atualizado, error: erroUpdate } = await supabaseAdmin
    .from("vendedores")
    .update({ user_id: userId, ativo: true, status_cadastro: "ativo" })
    .eq("id", params.id)
    .select()
    .single();
  if (erroUpdate) return NextResponse.json({ error: erroUpdate.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  const { data: linkData, error: erroLink } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: vendedor.email,
    options: { redirectTo: `${origin}/redefinir-senha` },
  });
  if (erroLink) {
    return NextResponse.json(
      { error: `Acesso criado, mas não consegui gerar o link de senha: ${erroLink.message}. Tente "Reenviar" de novo.` },
      { status: 500 }
    );
  }

  try {
    await enviarEmail({
      to: vendedor.email,
      subject: "Seu acesso de vendedor Vizinn",
      fromName: "Vizinn",
      html: `
        <p>Olá, ${vendedor.nome}!</p>
        <p>Seu acesso de vendedor na plataforma Vizinn foi liberado. Clique no link abaixo pra criar sua senha e entrar:</p>
        <p><a href="${linkData.properties.action_link}">Criar minha senha e acessar</a></p>
        <p>Depois de entrar, você encontra seu link de convite pra indicar novos vendedores no seu painel.</p>
      `,
    });
  } catch (erroEmail) {
    console.error("Erro ao enviar e-mail de acesso ao vendedor:", erroEmail);
    // Não falha a request — o acesso já foi criado, o admin pode reenviar depois.
  }

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "criar_acesso",
    entidade: "vendedor",
    entidadeId: params.id,
    dadosNovos: { user_id: userId },
  });

  return NextResponse.json({ success: true, vendedor: atualizado });
}

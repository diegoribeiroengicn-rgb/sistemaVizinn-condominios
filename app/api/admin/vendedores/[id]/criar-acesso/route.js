import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";

// Gera (ou redefine) o acesso de login pro vendedor: o admin digita
// (ou gera) uma senha na hora e ela é aplicada direto no Supabase
// Auth — sem link de recuperação, sem e-mail. O admin passa
// e-mail+senha pro vendedor pelo canal que quiser (WhatsApp, verbal
// etc.), dando autonomia total sem depender do Resend. Também aprova
// o cadastro (ativo=true, status_cadastro=ativo) — conceder acesso É
// a aprovação, pra quem se cadastrou pelo link de convite.
export async function POST(request, { params }) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { senha } = await request.json().catch(() => ({}));
  if (!senha || senha.length < 6) {
    return NextResponse.json({ error: "Informe uma senha de pelo menos 6 caracteres." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: vendedor, error: erroVendedor } = await supabaseAdmin
    .from("vendedores").select("*").eq("id", params.id).maybeSingle();
  if (erroVendedor) return NextResponse.json({ error: erroVendedor.message }, { status: 500 });
  if (!vendedor) return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });
  if (!vendedor.email) return NextResponse.json({ error: "Esse vendedor não tem e-mail cadastrado." }, { status: 400 });

  let userId = vendedor.user_id;

  if (!userId) {
    const { data: userData, error: erroCriarUser } = await supabaseAdmin.auth.admin.createUser({
      email: vendedor.email,
      password: senha,
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
  } else {
    // Já tinha acesso — redefine a senha em vez de criar outro usuário.
    const { error: erroSenha } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: senha });
    if (erroSenha) return NextResponse.json({ error: erroSenha.message }, { status: 500 });
  }

  const { data: atualizado, error: erroUpdate } = await supabaseAdmin
    .from("vendedores")
    .update({ user_id: userId, ativo: true, status_cadastro: "ativo" })
    .eq("id", params.id)
    .select()
    .single();
  if (erroUpdate) return NextResponse.json({ error: erroUpdate.message }, { status: 500 });

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "criar_acesso",
    entidade: "vendedor",
    entidadeId: params.id,
    dadosNovos: { user_id: userId },
  });

  return NextResponse.json({ success: true, vendedor: atualizado });
}

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { gerarCodigoIndicacao } from "@/lib/comissoes";

// Rota pública (sem login) por trás do link de indicação
// (vizinn.com.br/vendedor/convite/ABC123 — seção 25/26/27 do
// projeto). O vínculo com o indicador é resolvido SÓ pelo código no
// servidor — nunca aceito do corpo da requisição, então não dá pra
// manipular a URL pra se vincular a outra pessoa.
export async function GET(request, { params }) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: indicador, error } = await supabaseAdmin
    .from("vendedores")
    .select("id, nome, ativo")
    .eq("codigo_indicacao", (params.codigo || "").toUpperCase())
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!indicador || !indicador.ativo) {
    return NextResponse.json({ error: "Código de indicação inválido ou expirado." }, { status: 404 });
  }
  return NextResponse.json({ indicadorNome: indicador.nome });
}

export async function POST(request, { params }) {
  const { nome, email, telefone, senha } = await request.json();
  if (!nome?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 });
  }
  if (!senha || senha.length < 6) {
    return NextResponse.json({ error: "Escolha uma senha de pelo menos 6 caracteres." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: indicador, error: erroIndicador } = await supabaseAdmin
    .from("vendedores")
    .select("id, ativo")
    .eq("codigo_indicacao", (params.codigo || "").toUpperCase())
    .maybeSingle();
  if (erroIndicador) return NextResponse.json({ error: erroIndicador.message }, { status: 500 });
  if (!indicador || !indicador.ativo) {
    return NextResponse.json({ error: "Código de indicação inválido ou expirado." }, { status: 404 });
  }

  const emailNormalizado = email.trim().toLowerCase();
  const { data: existente } = await supabaseAdmin
    .from("vendedores").select("id").ilike("email", emailNormalizado).maybeSingle();
  if (existente) {
    return NextResponse.json({ error: "Já existe um cadastro de vendedor com este e-mail." }, { status: 409 });
  }

  let codigo = null;
  for (let tentativa = 0; tentativa < 5 && !codigo; tentativa++) {
    const candidato = gerarCodigoIndicacao();
    const { data: colisao } = await supabaseAdmin
      .from("vendedores").select("id").eq("codigo_indicacao", candidato).maybeSingle();
    if (!colisao) codigo = candidato;
  }

  const { data: padrao } = await supabaseAdmin
    .from("modelos_comissionamento").select("id").eq("padrao", true).maybeSingle();

  // Ele já define a própria senha aqui (autonomia total, sem e-mail
  // nenhum envolvido) — a aprovação do admin depois só liga `ativo`,
  // não precisa de mais nenhum passo pra ele conseguir entrar.
  const { data: userData, error: erroCriarUser } = await supabaseAdmin.auth.admin.createUser({
    email: emailNormalizado,
    password: senha,
    email_confirm: true,
    user_metadata: { tipo: "vendedor", nome: nome.trim() },
  });
  if (erroCriarUser) {
    if (erroCriarUser.message?.toLowerCase().includes("already")) {
      return NextResponse.json({ error: "Já existe uma conta com este e-mail no Vizinn." }, { status: 409 });
    }
    return NextResponse.json({ error: erroCriarUser.message }, { status: 500 });
  }

  const { error: erroCriar } = await supabaseAdmin.from("vendedores").insert({
    nome: nome.trim(),
    email: emailNormalizado,
    telefone: telefone?.trim() || null,
    user_id: userData.user.id,
    ativo: false, // só passa a vender depois que o admin aprovar
    status_cadastro: "pendente",
    indicador_original_id: indicador.id,
    lider_atual_id: indicador.id,
    modelo_comissionamento_id: padrao?.id || null,
    codigo_indicacao: codigo,
  });
  if (erroCriar) return NextResponse.json({ error: erroCriar.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

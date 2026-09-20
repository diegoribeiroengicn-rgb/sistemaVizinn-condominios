import { NextResponse } from "next/server";
import { requireCondominioOwner } from "@/lib/memberAuth";
import { ALL_MODULOS, DEFAULT_MODULOS_BY_PAPEL } from "@/lib/modulos";

const VALID_PAPEIS = new Set(["condomino", "porteiro", "conselheiro", "zelador"]);

// Síndico-only: creates a delimited-access account (condômino, porteiro,
// conselheiro or zelador) for their condominio — a real Supabase login the
// síndico hands to that person, scoped by Row Level Security to just the
// módulos concedidos (ver membros.modulos / membro_tem_modulo() no banco).
export async function POST(request) {
  const body = await request.json();
  const { condominioId, nome, email, telefone, password, papel, unidade, modulos } = body;

  const auth = await requireCondominioOwner(request, condominioId);
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

  // Sem lista explícita de módulos, usa o padrão sugerido pro papel; com
  // lista, filtra pra só aceitar chaves conhecidas (nunca confia no que o
  // cliente manda sem validar).
  const modulosValidos = Array.isArray(modulos)
    ? modulos.filter((m) => ALL_MODULOS.includes(m))
    : DEFAULT_MODULOS_BY_PAPEL[papel] || [];

  const { supabaseAdmin } = auth;

  // The login system is email-based (no phone/SMS auth configured), so
  // when the síndico leaves e-mail blank we still need one to create the
  // Supabase auth user — generate a stable placeholder from the phone
  // number and store it as `email` so it's visible in Acessos for the
  // síndico to hand over as the login.
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

    const { error: memberError } = await supabaseAdmin.from("membros").insert({
      condominio_id: condominioId,
      user_id: userData.user.id,
      nome,
      email: loginEmail,
      telefone: telefone || null,
      papel,
      unidade: unidade || null,
      modulos: modulosValidos,
    });

    if (memberError) {
      // Roll back the orphaned auth user so a failed insert doesn't leave
      // a login with no membro row (and no way to log in usefully).
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id).catch(() => {});
      throw memberError;
    }

    return NextResponse.json({ success: true, loginEmail });
  } catch (err) {
    console.error("members/create error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível criar o acesso." },
      { status: 500 }
    );
  }
}

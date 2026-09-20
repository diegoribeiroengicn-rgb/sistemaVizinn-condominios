import { NextResponse } from "next/server";
import { requireCondominioOwner } from "@/lib/memberAuth";

const VALID_PAPEIS = new Set(["condomino", "porteiro", "conselheiro", "zelador"]);

// Síndico-only: creates a delimited-access account (condômino, porteiro,
// conselheiro or zelador) for their condominio — a real Supabase login the
// síndico hands to that person, scoped by Row Level Security to just their
// papel.
export async function POST(request) {
  const body = await request.json();
  const { condominioId, nome, email, password, papel, unidade } = body;

  const auth = await requireCondominioOwner(request, condominioId);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!nome || !email || !password || !VALID_PAPEIS.has(papel)) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes ou papel inválido." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });
  }

  const { supabaseAdmin } = auth;

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome, papel },
    });

    if (userError) {
      if (userError.message?.toLowerCase().includes("already")) {
        return NextResponse.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
      }
      throw userError;
    }

    const { error: memberError } = await supabaseAdmin.from("membros").insert({
      condominio_id: condominioId,
      user_id: userData.user.id,
      nome,
      email,
      papel,
      unidade: unidade || null,
    });

    if (memberError) {
      // Roll back the orphaned auth user so a failed insert doesn't leave
      // a login with no membro row (and no way to log in usefully).
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id).catch(() => {});
      throw memberError;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("members/create error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível criar o acesso." },
      { status: 500 }
    );
  }
}

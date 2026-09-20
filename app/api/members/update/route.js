import { NextResponse } from "next/server";
import { requireCondominioOwner } from "@/lib/memberAuth";
import { ALL_MODULOS } from "@/lib/modulos";

const VALID_PAPEIS = new Set(["condomino", "porteiro", "conselheiro", "zelador"]);

// Síndico-only: edits an existing member's papel/unidade/telefone/nome and
// which módulos they can see — e.g. promoting a condômino to conselheiro,
// fixing a typo, or granting/removendo um módulo avulso sem trocar o
// papel. Does not touch the login (e-mail/senha); see
// /api/members/reset-password for that.
export async function POST(request) {
  const body = await request.json();
  const { condominioId, memberId, nome, telefone, papel, unidade, modulos } = body;

  const auth = await requireCondominioOwner(request, condominioId);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!memberId || !nome || !VALID_PAPEIS.has(papel)) {
    return NextResponse.json(
      { error: "Dados obrigatórios ausentes ou papel inválido." },
      { status: 400 }
    );
  }

  const modulosValidos = Array.isArray(modulos)
    ? modulos.filter((m) => ALL_MODULOS.includes(m))
    : [];

  const { supabaseAdmin } = auth;

  try {
    const { error } = await supabaseAdmin
      .from("membros")
      .update({
        nome,
        telefone: telefone || null,
        papel,
        unidade: unidade || null,
        modulos: modulosValidos,
      })
      .eq("id", memberId)
      .eq("condominio_id", condominioId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("members/update error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível editar o acesso." },
      { status: 500 }
    );
  }
}

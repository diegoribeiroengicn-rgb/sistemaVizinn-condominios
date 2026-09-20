import { NextResponse } from "next/server";
import { requireCondominioOwner } from "@/lib/memberAuth";

// Síndico-only: sets a new temporary password for a member who lost
// theirs. Verifies the membro really belongs to this condominio before
// touching their auth account.
export async function POST(request) {
  const body = await request.json();
  const { condominioId, memberId, userId, newPassword } = body;

  const auth = await requireCondominioOwner(request, condominioId);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!memberId || !userId || !newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { error: "Dados inválidos (senha deve ter ao menos 6 caracteres)." },
      { status: 400 }
    );
  }

  const { supabaseAdmin } = auth;

  try {
    const { data: membro, error: membroError } = await supabaseAdmin
      .from("membros")
      .select("id")
      .eq("id", memberId)
      .eq("condominio_id", condominioId)
      .maybeSingle();

    if (membroError) throw membroError;
    if (!membro) {
      return NextResponse.json(
        { error: "Acesso não encontrado neste condomínio." },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("members/reset-password error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível redefinir a senha." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { requireCondominioOwner } from "@/lib/memberAuth";

// Síndico-only: revokes a delimited-access account entirely (removes the
// membros row and deletes the underlying Supabase login, so it can't be
// used to sign in anymore).
export async function POST(request) {
  const body = await request.json();
  const { condominioId, memberId, userId } = body;

  const auth = await requireCondominioOwner(request, condominioId);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!memberId || !userId) {
    return NextResponse.json({ error: "memberId e userId são obrigatórios." }, { status: 400 });
  }

  const { supabaseAdmin } = auth;

  try {
    const { error: deleteError } = await supabaseAdmin
      .from("membros")
      .delete()
      .eq("id", memberId)
      .eq("condominio_id", condominioId);
    if (deleteError) throw deleteError;

    await supabaseAdmin.auth.admin.deleteUser(userId).catch((err) => {
      console.error("Erro ao remover login do membro:", err);
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("members/delete error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível remover o acesso." },
      { status: 500 }
    );
  }
}

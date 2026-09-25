import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

const CAMPOS = {
  titulo: "titulo",
  modulo: "modulo",
  papelAlvo: "papel_alvo",
  publico: "publico",
  respostaCurta: "resposta_curta",
  passoAPasso: "passo_a_passo",
  ativo: "ativo",
};

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request, "chatbot");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const updates = {};
  for (const [chave, coluna] of Object.entries(CAMPOS)) {
    if (chave in body) updates[coluna] = body[chave];
  }
  if ("palavrasChave" in body) {
    updates.palavras_chave = (body.palavrasChave || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("base_conhecimento").update(updates).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request, "chatbot");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("base_conhecimento").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

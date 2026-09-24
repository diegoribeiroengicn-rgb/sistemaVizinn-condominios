import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("base_conhecimento")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ itens: data || [] });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { titulo, modulo, papelAlvo, publico, respostaCurta, passoAPasso, palavrasChave } = await request.json();
  if (!titulo?.trim() || !respostaCurta?.trim()) {
    return NextResponse.json({ error: "Preencha título e resposta." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("base_conhecimento")
    .insert({
      titulo: titulo.trim(),
      modulo: modulo || null,
      papel_alvo: papelAlvo || null,
      publico: Boolean(publico),
      resposta_curta: respostaCurta.trim(),
      passo_a_passo: passoAPasso?.trim() || null,
      palavras_chave: (palavrasChave || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

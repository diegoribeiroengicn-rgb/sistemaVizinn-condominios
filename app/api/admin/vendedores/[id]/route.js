import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

const CAMPOS_PERMITIDOS = { nome: "nome", email: "email", telefone: "telefone", comissaoPercentual: "comissao_percentual", ativo: "ativo" };

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const updates = {};
  for (const [chave, coluna] of Object.entries(CAMPOS_PERMITIDOS)) {
    if (chave in body) updates[coluna] = body[chave];
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("vendedores").update(updates).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("vendedores").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

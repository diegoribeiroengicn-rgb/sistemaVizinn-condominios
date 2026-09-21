import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Platform-owner-only: gestão da base geral de Fornecedores Vizinn
// (fornecedores_globais) — bypassa RLS via service role, acesso gated
// só por requireAdmin(). Nenhum síndico consegue editar/apagar essa
// tabela pela RLS normal (ver supabase/schema.sql); é essa rota que
// faz isso, com auditoria pelo lado do owner.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  let query = supabaseAdmin.from("fornecedores_globais").select("*").order("razao_social", { ascending: true });
  if (q) {
    const digitos = q.replace(/\D/g, "");
    if (digitos.length >= 4) query = query.ilike("cnpj", `%${digitos}%`);
    else query = query.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%`);
  }
  const { data: globais, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: locais, error: locaisError } = await supabaseAdmin
    .from("fornecedores")
    .select("fornecedor_global_id, condominio_id")
    .not("fornecedor_global_id", "is", null);
  if (locaisError) return NextResponse.json({ error: locaisError.message }, { status: 500 });

  const condominiosPorGlobal = {};
  for (const l of locais || []) {
    (condominiosPorGlobal[l.fornecedor_global_id] ||= new Set()).add(l.condominio_id);
  }

  const fornecedores = (globais || []).map((g) => ({
    ...g,
    total_condominios: condominiosPorGlobal[g.id]?.size || 0,
  }));

  return NextResponse.json({ fornecedores });
}

export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { id, ...campos } = body;
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  const camposPermitidos = ["razao_social", "nome_fantasia", "endereco", "categoria", "categorias", "status"];
  const updates = { updated_at: new Date().toISOString() };
  for (const campo of camposPermitidos) {
    if (campo in campos) updates[campo] = campos[campo];
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("fornecedores_globais").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("fornecedores_globais").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

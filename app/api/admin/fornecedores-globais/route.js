import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Platform-owner-only: gestão da base geral de Fornecedores Vizinn
// (fornecedores_globais) — bypassa RLS via service role, acesso gated
// só por requireAdmin(). Nenhum síndico consegue editar/apagar essa
// tabela pela RLS normal (ver supabase/schema.sql); é essa rota que
// faz isso, com auditoria pelo lado do owner.
export async function GET(request) {
  const auth = await requireAdmin(request, "fornecedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(2000, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from("fornecedores_globais")
    .select("*", { count: "exact" })
    .order("razao_social", { ascending: true });
  if (q) {
    const digitos = q.replace(/\D/g, "");
    if (digitos.length >= 4) query = query.ilike("cnpj", `%${digitos}%`);
    else query = query.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%`);
  }
  const { data: globais, error, count } = await query.range(from, to);
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

  const idsGlobais = (globais || []).map((g) => g.id);
  const { data: destaques } = idsGlobais.length
    ? await supabaseAdmin
        .from("fornecedores_destaque_comercial")
        .select("fornecedor_global_id, nivel")
        .in("fornecedor_global_id", idsGlobais)
    : { data: [] };
  const nivelPorGlobal = {};
  for (const d of destaques || []) nivelPorGlobal[d.fornecedor_global_id] = d.nivel;

  const fornecedores = (globais || []).map((g) => ({
    ...g,
    total_condominios: condominiosPorGlobal[g.id]?.size || 0,
    nivel_destaque: nivelPorGlobal[g.id] || 0,
  }));

  return NextResponse.json(
    { fornecedores, total: count ?? 0, page, pageSize },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}

export async function POST(request) {
  const auth = await requireAdmin(request, "fornecedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const cnpj = (body.cnpj || "").replace(/\D/g, "");
  const razaoSocial = (body.razao_social || "").trim();
  if (!razaoSocial) return NextResponse.json({ error: "Razão social é obrigatória." }, { status: 400 });
  if (cnpj.length !== 14) return NextResponse.json({ error: "CNPJ inválido — informe os 14 dígitos." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: existente } = await supabaseAdmin
    .from("fornecedores_globais")
    .select("id")
    .eq("cnpj", cnpj)
    .maybeSingle();
  if (existente) {
    return NextResponse.json({ error: "Já existe um fornecedor na base geral com esse CNPJ." }, { status: 409 });
  }

  const { data: criado, error } = await supabaseAdmin
    .from("fornecedores_globais")
    .insert({
      cnpj,
      razao_social: razaoSocial,
      nome_fantasia: body.nome_fantasia?.trim() || null,
      endereco: body.endereco?.trim() || null,
      categorias: body.categorias || [],
      categoria: body.categorias?.[0] || null,
      status: body.status || "ativo",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: criado.id });
}

export async function PATCH(request) {
  const auth = await requireAdmin(request, "fornecedores");
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
  const auth = await requireAdmin(request, "fornecedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("fornecedores_globais").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

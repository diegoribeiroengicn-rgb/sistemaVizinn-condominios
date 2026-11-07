import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Tabela de preços progressiva do Pro+ Multicondomínios — ver
// lib/multicondominios.js pros cálculos e
// /api/public/multicondominios-faixas pra leitura fora do admin
// (dashboard do síndico, página de vendas).
export async function GET(request) {
  const auth = await requireAdmin(request, "condominios");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.from("multicondominios_faixas").select("*").order("ordem");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ faixas: data || [] });
}

export async function POST(request) {
  const auth = await requireAdmin(request, "condominios");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { equivalentesMin, equivalentesMax, mensalidade, ordem } = await request.json().catch(() => ({}));
  if (!Number.isFinite(Number(equivalentesMin)) || !Number.isFinite(Number(mensalidade))) {
    return NextResponse.json({ error: "equivalentesMin e mensalidade são obrigatórios." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("multicondominios_faixas").insert({
    equivalentes_min: Number(equivalentesMin),
    equivalentes_max: equivalentesMax === "" || equivalentesMax == null ? null : Number(equivalentesMax),
    mensalidade: Number(mensalidade),
    ordem: Number.isFinite(Number(ordem)) ? Number(ordem) : 0,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request) {
  const auth = await requireAdmin(request, "condominios");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, equivalentesMin, equivalentesMax, mensalidade, ordem, ativo } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  const patch = { updated_at: new Date().toISOString() };
  if (equivalentesMin != null) patch.equivalentes_min = Number(equivalentesMin);
  if (equivalentesMax !== undefined) patch.equivalentes_max = equivalentesMax === "" || equivalentesMax == null ? null : Number(equivalentesMax);
  if (mensalidade != null) patch.mensalidade = Number(mensalidade);
  if (ordem != null) patch.ordem = Number(ordem);
  if (ativo != null) patch.ativo = Boolean(ativo);

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("multicondominios_faixas").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const auth = await requireAdmin(request, "condominios");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("multicondominios_faixas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.from("taxas_adesao").select("*").order("plano_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ taxas: data || [] });
}

export async function PATCH(request) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { planoId, valor, teto } = await request.json();
  if (!planoId || (valor == null && teto == null)) {
    return NextResponse.json({ error: "planoId e (valor ou teto) são obrigatórios." }, { status: 400 });
  }
  if (valor != null && (!Number.isFinite(Number(valor)) || Number(valor) < 0)) {
    return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  }
  if (teto != null && (!Number.isFinite(Number(teto)) || Number(teto) < 0)) {
    return NextResponse.json({ error: "Teto inválido." }, { status: 400 });
  }

  const patch = { plano_id: planoId, updated_at: new Date().toISOString() };
  if (valor != null) patch.valor = Number(valor);
  if (teto != null) patch.teto = Number(teto);

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("taxas_adesao").upsert(patch, { onConflict: "plano_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

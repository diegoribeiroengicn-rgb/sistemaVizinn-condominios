import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.from("taxas_adesao").select("*").order("plano_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ taxas: data || [] });
}

export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { planoId, valor } = await request.json();
  if (!planoId || valor == null || Number(valor) < 0) {
    return NextResponse.json({ error: "planoId e valor (>= 0) são obrigatórios." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("taxas_adesao")
    .upsert({ plano_id: planoId, valor: Number(valor), updated_at: new Date().toISOString() }, { onConflict: "plano_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

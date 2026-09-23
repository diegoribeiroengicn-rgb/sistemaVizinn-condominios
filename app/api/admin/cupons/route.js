import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("cupons")
    .select("*, vendedores(nome)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cupons: data || [] });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { codigo, vendedorId, tipo, valor, usosMaximo } = await request.json();
  if (!codigo?.trim()) return NextResponse.json({ error: "Código é obrigatório." }, { status: 400 });
  if (!["percentual", "valor_fixo", "isencao"].includes(tipo)) {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("cupons")
    .insert({
      codigo: codigo.trim().toUpperCase(),
      vendedor_id: vendedorId || null,
      tipo,
      valor: tipo === "isencao" ? null : Number(valor) || 0,
      usos_maximo: usosMaximo || null,
    })
    .select()
    .single();
  if (error) {
    const msg = error.code === "23505" ? "Já existe um cupom com esse código." : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ cupom: data });
}

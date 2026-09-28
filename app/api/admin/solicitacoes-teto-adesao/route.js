import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Lista as solicitações de aumento de teto de adesão pra revisão do
// admin — mais recentes primeiro, com o nome do vendedor junto (join).
export async function GET(request) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("solicitacoes_teto_adesao")
    .select("*, vendedores(nome)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ solicitacoes: data || [] });
}

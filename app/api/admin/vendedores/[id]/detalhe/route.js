import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { montarDetalheVendedor } from "@/lib/comissoes";

// Detalhamento completo de um vendedor (seção 22 do projeto) — mesma
// lógica que o próprio vendedor vê de si mesmo em /api/vendedor/me,
// compartilhada via lib/comissoes.js (montarDetalheVendedor).
export async function GET(request, { params }) {
  const auth = await requireAdmin(request, "vendedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  try {
    const detalhe = await montarDetalheVendedor(supabaseAdmin, params.id);
    if (!detalhe) return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });
    return NextResponse.json(detalhe);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

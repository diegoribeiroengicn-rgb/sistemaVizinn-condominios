import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Dashboard → Comissões: listagem com rastreabilidade completa (seção
// 33) — cada linha já traz vendedor, condomínio, tipo, percentual,
// valor, competência, status, regra aplicada.
export async function GET(request) {
  const auth = await requireAdmin(request, "comissoes");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const vendedorId = searchParams.get("vendedorId");
  const tipo = searchParams.get("tipo");
  const status = searchParams.get("status");
  const competencia = searchParams.get("competencia");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10) || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from("comissoes")
    .select(
      "*, condominios(nome), beneficiario:vendedor_beneficiario_id(nome), vendedorVenda:vendedor_venda_id(nome), modelos_comissionamento(nome)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (vendedorId) query = query.eq("vendedor_beneficiario_id", vendedorId);
  if (tipo) query = query.eq("tipo", tipo);
  if (status) query = query.eq("status", status);
  if (competencia) query = query.eq("competencia", competencia);

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const comissoes = (data || []).map((c) => ({
    ...c,
    condominio_nome: c.condominios?.nome || null,
    beneficiario_nome: c.beneficiario?.nome || null,
    vendedor_venda_nome: c.vendedorVenda?.nome || null,
    modelo_nome: c.modelos_comissionamento?.nome || null,
    condominios: undefined,
    beneficiario: undefined,
    vendedorVenda: undefined,
    modelos_comissionamento: undefined,
  }));

  return NextResponse.json({ comissoes, total: count ?? 0, page, pageSize });
}

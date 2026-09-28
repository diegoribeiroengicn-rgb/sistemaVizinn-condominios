import { NextResponse } from "next/server";
import { requireVendedor } from "@/lib/vendedorAuth";
import { tetoEfetivo } from "@/lib/tetoAdesao";

// Teto de adesão por plano + minhas próprias solicitações de aumento
// (não vejo pedido de outro vendedor — igual espírito de /api/vendedor/me).
export async function GET(request) {
  const auth = await requireVendedor(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin, vendedor } = auth;
  const [{ data: taxasRaw, error: erroTaxas }, { data: solicitacoes, error: erroSolicitacoes }] = await Promise.all([
    supabaseAdmin.from("taxas_adesao").select("*").order("plano_id"),
    supabaseAdmin
      .from("solicitacoes_teto_adesao")
      .select("*")
      .eq("vendedor_id", vendedor.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (erroTaxas) return NextResponse.json({ error: erroTaxas.message }, { status: 500 });
  if (erroSolicitacoes) return NextResponse.json({ error: erroSolicitacoes.message }, { status: 500 });

  const taxas = (taxasRaw || []).map((t) => ({
    planoId: t.plano_id,
    valor: Number(t.valor),
    teto: tetoEfetivo(t),
  }));

  return NextResponse.json({ taxas, solicitacoes: solicitacoes || [] });
}

import { NextResponse } from "next/server";
import { requireVendedor } from "@/lib/vendedorAuth";
import { tetoEfetivo } from "@/lib/tetoAdesao";

// Vendedor pede aumento do teto de adesão de um plano — cria um
// pedido "pendente" pro admin revisar em /admin/pagamentos (ver
// PATCH em /api/admin/solicitacoes-teto-adesao/[id], que já sobe o
// teto de verdade quando aprova).
export async function POST(request) {
  const auth = await requireVendedor(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { planoId, valorSolicitado, motivo } = await request.json();
  const valor = Number(valorSolicitado);
  if (!planoId || !Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: "Informe o plano e um valor pedido válido." }, { status: 400 });
  }

  const { supabaseAdmin, vendedor } = auth;
  const { data: taxa, error: erroTaxa } = await supabaseAdmin
    .from("taxas_adesao")
    .select("*")
    .eq("plano_id", planoId)
    .maybeSingle();
  if (erroTaxa) return NextResponse.json({ error: erroTaxa.message }, { status: 500 });
  if (!taxa) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  const tetoAtual = tetoEfetivo(taxa);

  const { data: pendenteExistente } = await supabaseAdmin
    .from("solicitacoes_teto_adesao")
    .select("id")
    .eq("vendedor_id", vendedor.id)
    .eq("plano_id", planoId)
    .eq("status", "pendente")
    .maybeSingle();
  if (pendenteExistente) {
    return NextResponse.json({ error: "Você já tem um pedido de aumento pendente pra esse plano." }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from("solicitacoes_teto_adesao")
    .insert({
      vendedor_id: vendedor.id,
      plano_id: planoId,
      teto_atual: tetoAtual,
      valor_solicitado: valor,
      motivo: motivo?.trim() || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, solicitacao: data });
}

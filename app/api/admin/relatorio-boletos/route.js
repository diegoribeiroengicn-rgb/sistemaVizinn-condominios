import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Relatório interno (seção 8.1 do prompt de upgrade): visão consolidada e
// por condomínio de boletos emitidos/pagos e do resultado da tarifa de
// cobrança (margem AquiHabitto + custo Asaas vs. o que foi efetivamente
// cobrado do condômino). boleto_tarifa_lancamentos só passa a ter linhas
// quando a tarifa for de fato cobrada na emissão real (etapa ainda
// pendente de validação com o Asaas) — até lá este relatório mostra os
// boletos emitidos/pagos normalmente e os totais de tarifa zerados.
export async function GET(request) {
  const auth = await requireAdmin(request, "financeiro");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();

  const [{ data: condominios, error: condError }, { data: contas, error: contasError }, { data: lancamentos, error: lancError }] =
    await Promise.all([
      supabaseAdmin.from("condominios").select("id, nome"),
      supabaseAdmin
        .from("contas_receber")
        .select("id, condominio_id, status, valor, valor_recebido, asaas_charge_id")
        .not("asaas_charge_id", "is", null),
      supabaseAdmin
        .from("boleto_tarifa_lancamentos")
        .select("condominio_id, tarifa_cobrada, custo_operacional, diferenca"),
    ]);

  if (condError) return NextResponse.json({ error: condError.message }, { status: 500 });
  if (contasError) return NextResponse.json({ error: contasError.message }, { status: 500 });
  if (lancError) return NextResponse.json({ error: lancError.message }, { status: 500 });

  const nomesPorCondominio = new Map((condominios || []).map((c) => [c.id, c.nome]));

  const porCondominio = new Map();
  function linha(condominioId) {
    if (!porCondominio.has(condominioId)) {
      porCondominio.set(condominioId, {
        condominioId,
        nome: nomesPorCondominio.get(condominioId) || "(condomínio removido)",
        boletosEmitidos: 0,
        boletosPagos: 0,
        valorRecebido: 0,
        tarifaCobrada: 0,
        custoOperacional: 0,
        diferenca: 0,
      });
    }
    return porCondominio.get(condominioId);
  }

  for (const conta of contas || []) {
    const l = linha(conta.condominio_id);
    l.boletosEmitidos += 1;
    if (conta.status === "recebida") {
      l.boletosPagos += 1;
      l.valorRecebido += Number(conta.valor_recebido ?? conta.valor) || 0;
    }
  }

  for (const lanc of lancamentos || []) {
    const l = linha(lanc.condominio_id);
    l.tarifaCobrada += Number(lanc.tarifa_cobrada) || 0;
    l.custoOperacional += Number(lanc.custo_operacional) || 0;
    l.diferenca += Number(lanc.diferenca) || 0;
  }

  const porCondominioArray = Array.from(porCondominio.values()).sort((a, b) => b.boletosEmitidos - a.boletosEmitidos);

  const totais = porCondominioArray.reduce(
    (acc, l) => ({
      boletosEmitidos: acc.boletosEmitidos + l.boletosEmitidos,
      boletosPagos: acc.boletosPagos + l.boletosPagos,
      valorRecebido: acc.valorRecebido + l.valorRecebido,
      tarifaCobrada: acc.tarifaCobrada + l.tarifaCobrada,
      custoOperacional: acc.custoOperacional + l.custoOperacional,
      diferenca: acc.diferenca + l.diferenca,
    }),
    { boletosEmitidos: 0, boletosPagos: 0, valorRecebido: 0, tarifaCobrada: 0, custoOperacional: 0, diferenca: 0 }
  );

  return NextResponse.json({ totais, porCondominio: porCondominioArray });
}

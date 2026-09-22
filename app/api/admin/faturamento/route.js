import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { requireAdmin } from "@/lib/adminAuth";

// Platform-owner-only: faturamento real (dinheiro que efetivamente
// entrou), direto do Stripe — nunca uma estimativa a partir do status
// atual dos condomínios, já que assinaturas mudam de status ao longo do
// tempo e só o Stripe tem o histórico exato de cobranças pagas.
function chaveMes(timestampSegundos) {
  const d = new Date(timestampSegundos * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ stripeConfigurado: false });
  }

  const agora = new Date();
  const treze_meses_atras = new Date(agora.getFullYear(), agora.getMonth() - 12, 1);
  const gte = Math.floor(treze_meses_atras.getTime() / 1000);

  const faturas = [];
  let startingAfter;
  try {
    for (let pagina = 0; pagina < 20; pagina++) {
      const resultado = await stripe.invoices.list({
        status: "paid",
        created: { gte },
        limit: 100,
        starting_after: startingAfter,
      });
      faturas.push(...resultado.data);
      if (!resultado.has_more) break;
      startingAfter = resultado.data[resultado.data.length - 1]?.id;
    }
  } catch (err) {
    console.error("Erro ao buscar faturas no Stripe:", err.message);
    return NextResponse.json({ error: "Não foi possível consultar o Stripe." }, { status: 500 });
  }

  const porMes = {};
  for (const fatura of faturas) {
    const chave = chaveMes(fatura.created);
    porMes[chave] = (porMes[chave] || 0) + (fatura.amount_paid || 0) / 100;
  }

  const buckets = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ chave, label: d.toLocaleDateString("pt-BR", { month: "short" }), valor: porMes[chave] || 0 });
  }

  const chaveMesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const faturamentoMesAtual = porMes[chaveMesAtual] || 0;
  const faturamentoYTD = Object.entries(porMes)
    .filter(([chave]) => chave.startsWith(`${agora.getFullYear()}-`))
    .reduce((soma, [, valor]) => soma + valor, 0);

  return NextResponse.json({
    stripeConfigurado: true,
    faturamentoMesAtual,
    faturamentoYTD,
    anoAtual: agora.getFullYear(),
    ultimos12Meses: buckets,
  });
}

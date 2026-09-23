import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPlan, VALOR_MINIMO_COBRANCA_CENTAVOS } from "@/lib/plans";
import { calcularAdesaoComCupom, cupomEstaValido } from "@/lib/cupons";

// Cria o PaymentIntent da taxa de adesão do plano escolhido (com
// desconto de cupom, se houver) — substitui o antigo R$ 1,00 de
// validação de cartão. Quando o valor final é zero (cupom de isenção
// total), não cria PaymentIntent nenhum: retorna { isento: true } e o
// cadastro segue direto sem cobrança nenhuma agora (a assinatura
// continua tendo os 14 dias de teste grátis normalmente).
export async function POST(request) {
  try {
    const { planId, email, cupomCodigo } = await request.json();
    const plan = getPlan(planId);

    const supabaseAdmin = getSupabaseAdmin();
    const { data: taxaRow } = await supabaseAdmin
      .from("taxas_adesao")
      .select("valor")
      .eq("plano_id", plan.id)
      .maybeSingle();
    const taxaAdesao = Number(taxaRow?.valor) || 0;

    let cupom = null;
    if (cupomCodigo?.trim()) {
      const { data } = await supabaseAdmin
        .from("cupons")
        .select("*")
        .eq("codigo", cupomCodigo.trim().toUpperCase())
        .maybeSingle();
      if (data && cupomEstaValido(data)) cupom = data;
    }

    const valorFinal = calcularAdesaoComCupom(taxaAdesao, cupom);

    if (valorFinal <= 0) {
      return NextResponse.json({ isento: true, valorFinal: 0 });
    }

    let amountCents = Math.round(valorFinal * 100);
    if (amountCents < VALOR_MINIMO_COBRANCA_CENTAVOS) amountCents = VALOR_MINIMO_COBRANCA_CENTAVOS;

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "brl",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      receipt_email: email || undefined,
      description: `Vizinn - Taxa de adesão (plano ${plan.name})`,
      metadata: { planId: plan.id, purpose: "signup_adesao", cupomCodigo: cupom?.codigo || "" },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, valorFinal: amountCents / 100 });
  } catch (err) {
    console.error("create-payment-intent error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível iniciar o pagamento." },
      { status: 500 }
    );
  }
}

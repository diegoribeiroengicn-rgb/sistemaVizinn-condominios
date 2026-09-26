import { NextResponse } from "next/server";
import { requireVendedor } from "@/lib/vendedorAuth";
import { getStripe } from "@/lib/stripe";

// Gera um link de pagamento avulso (Stripe Payment Link) pro
// vendedor cobrar a adesão do síndico antes de fechar a venda —
// opção extra ao lado de digitar o valor direto no formulário (pra
// quando o vendedor já recebeu por fora). Não define os métodos de
// pagamento na mão: deixa em branco pra a Stripe mostrar
// automaticamente o que já está habilitado na conta (cartão sempre
// funciona; pix e boleto aparecem sozinhos assim que forem ativados
// no painel da Stripe, sem precisar mexer em código aqui).
export async function POST(request) {
  const auth = await requireVendedor(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { descricao, valor } = await request.json();
  const valorNumero = Number(valor);
  if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
    return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const link = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: Math.round(valorNumero * 100),
            product_data: {
              name: descricao?.trim() || "Taxa de adesão Vizinn",
            },
          },
          quantity: 1,
        },
      ],
      metadata: { vendedorId: auth.vendedor.id, vendedorNome: auth.vendedor.nome },
    });
    return NextResponse.json({ url: link.url });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Erro ao gerar link de pagamento." }, { status: 500 });
  }
}

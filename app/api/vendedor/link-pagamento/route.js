import { NextResponse } from "next/server";
import { requireVendedor } from "@/lib/vendedorAuth";
import { getStripe } from "@/lib/stripe";
import { tetoEfetivo } from "@/lib/tetoAdesao";

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

  const { descricao, valor, planoId } = await request.json();
  const valorNumero = Number(valor);
  if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
    return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
  }

  // Mesmo teto do cadastro de venda manual (ver
  // /api/vendedor/cadastrar-condominio) — o link de pagamento é só
  // outra forma de cobrar a mesma adesão, não pode furar o limite.
  if (planoId) {
    const { data: taxaPlano, error: erroTaxaPlano } = await auth.supabaseAdmin
      .from("taxas_adesao")
      .select("*")
      .eq("plano_id", planoId)
      .maybeSingle();
    if (erroTaxaPlano) return NextResponse.json({ error: erroTaxaPlano.message }, { status: 500 });
    const teto = taxaPlano ? tetoEfetivo(taxaPlano) : null;
    if (teto != null && valorNumero > teto) {
      return NextResponse.json(
        { error: `Valor acima do teto de adesão desse plano (R$ ${teto.toFixed(2)}). Peça aumento no seu painel.` },
        { status: 400 }
      );
    }
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
              name: descricao?.trim() || "Taxa de adesão AquiHabitto",
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

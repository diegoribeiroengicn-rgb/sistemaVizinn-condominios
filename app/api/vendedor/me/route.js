import { NextResponse } from "next/server";
import { requireVendedor } from "@/lib/vendedorAuth";
import { montarDetalheVendedor } from "@/lib/comissoes";

// "Meu painel" — o vendedor só consegue ver os próprios dados nunca
// os de outro vendedor: o id nem vem da URL, vem só do token (via
// requireVendedor), então não tem como manipular pra ver dado alheio.
export async function GET(request) {
  const auth = await requireVendedor(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const detalhe = await montarDetalheVendedor(auth.supabaseAdmin, auth.vendedor.id);

    // montarDetalheVendedor traz o histórico de comissão com qualquer
    // linha em que o vendedor apareça (beneficiário OU quem vendeu) —
    // faz sentido pro admin ver tudo, mas pro próprio vendedor só pode
    // ir o que É dele: uma comissão de liderança do líder dele, por
    // exemplo, também referencia o próprio vendedor como "quem
    // vendeu", e mostrar isso revelaria o valor que o líder ganhou em
    // cima da venda dele. O vendedor só vê o que ele mesmo é o
    // beneficiário.
    const historicoProprio = detalhe.comissoes.historico.filter(
      (c) => c.vendedor_beneficiario_id === auth.vendedor.id
    );
    detalhe.comissoes.historico = historicoProprio;

    return NextResponse.json(detalhe);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

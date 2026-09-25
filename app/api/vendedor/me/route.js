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
    return NextResponse.json(detalhe);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

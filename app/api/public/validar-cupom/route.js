import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cupomEstaValido } from "@/lib/cupons";
import { limitarTaxa, respostaLimiteExcedido } from "@/lib/rateLimit";

// Pública — o formulário de cadastro chama isso quando a pessoa digita
// um código de cupom, pra mostrar o desconto antes de pagar. Nunca
// revela mais do que o necessário (nem vendedor, nem quantidade de
// usos restante).
export const dynamic = "force-dynamic";

export async function GET(request) {
  const limite = limitarTaxa(request, { chave: "validar-cupom", limite: 20, janelaMs: 10 * 60 * 1000 });
  if (!limite.permitido) return respostaLimiteExcedido(limite.retryAfterSegundos);

  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get("codigo")?.trim().toUpperCase();
  if (!codigo) return NextResponse.json({ valido: false, error: "Informe um código." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: cupom, error } = await supabaseAdmin
    .from("cupons")
    .select("*")
    .eq("codigo", codigo)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cupom || !cupomEstaValido(cupom)) {
    return NextResponse.json({ valido: false, error: "Cupom inválido ou expirado." });
  }

  return NextResponse.json({ valido: true, codigo: cupom.codigo, tipo: cupom.tipo, valor: cupom.valor });
}

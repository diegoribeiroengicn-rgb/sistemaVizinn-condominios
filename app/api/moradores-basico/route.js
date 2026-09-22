import { NextResponse } from "next/server";
import { requireCondominioAccess } from "@/lib/memberAuth";

// Lista mínima de moradores (nome/unidade/contato, sem observações) pra
// preencher o seletor opcional de morador em Chamados. Gated pela
// permissão de "chamados" (criar), não de "moradores" — quem pode abrir
// um chamado precisa poder escolher de quem é, mesmo sem acesso ao
// módulo Moradores (ex: porteiro).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const condominioId = searchParams.get("condominioId");

  const auth = await requireCondominioAccess(request, condominioId, "chamados", "criar");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin } = auth;
  const { data, error } = await supabaseAdmin
    .from("moradores")
    .select("id, nome, unidade, bloco, email, telefone")
    .eq("condominio_id", condominioId)
    .order("nome", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ moradores: data || [] });
}

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { consultarSaldo } from "@/lib/asaas";

// Extrato consolidado de saldo Asaas por condomínio (seção 10 do
// prompt de upgrade) — só os condomínios da própria conta logada.
// Reaproveita consultarSaldo(), a mesma função já usada em
// /api/financeiro/asaas-subconta pra um condomínio só; aqui só chama
// uma vez por condomínio com subconta ativa e soma. Saldo é só
// informativo: se o Asaas estiver fora do ar pra uma subconta, essa
// linha volta com saldo null em vez de travar o extrato inteiro.
export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  const { data: condominios, error: condError } = await supabaseAdmin
    .from("condominios")
    .select("id, nome")
    .eq("owner_id", authData.user.id);
  if (condError) return NextResponse.json({ error: condError.message }, { status: 500 });
  if (!condominios || condominios.length === 0) return NextResponse.json({ condominios: [], totalSaldo: null });

  const condominioIds = condominios.map((c) => c.id);
  const { data: subcontas, error: subError } = await supabaseAdmin
    .from("condominios_asaas")
    .select("condominio_id, status, api_key")
    .in("condominio_id", condominioIds);
  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 });

  const subcontaPorCondominio = new Map((subcontas || []).map((s) => [s.condominio_id, s]));

  const linhas = await Promise.all(
    condominios.map(async (c) => {
      const subconta = subcontaPorCondominio.get(c.id);
      if (!subconta || subconta.status !== "ativa") {
        return { condominioId: c.id, nome: c.nome, ativo: false, saldo: null };
      }
      try {
        const saldo = await consultarSaldo(subconta.api_key);
        return { condominioId: c.id, nome: c.nome, ativo: true, saldo };
      } catch {
        return { condominioId: c.id, nome: c.nome, ativo: true, saldo: null };
      }
    })
  );

  const comSaldo = linhas.filter((l) => typeof l.saldo === "number");
  const totalSaldo = comSaldo.length > 0 ? comSaldo.reduce((s, l) => s + l.saldo, 0) : null;

  return NextResponse.json({ condominios: linhas, totalSaldo });
}

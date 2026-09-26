import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Painel admin — listagem/busca escalável de Condomínios. Busca sempre
// paginada no banco (nunca carrega a base inteira pra filtrar no
// navegador), por nome (trecho, via índice trigram) ou CNPJ com/sem
// pontuação (via a coluna gerada `cnpj_digits`, também indexada). Ver
// supabase/schema.sql.
export async function GET(request) {
  const auth = await requireAdmin(request, "condominios");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const termo = (searchParams.get("q") || "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(2000, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabaseAdmin = getSupabaseAdmin();

  // Monta o filtro (nome/CNPJ) uma vez e aplica igual nas duas
  // consultas abaixo (dados + contagem) — antes era uma query só com
  // `{ count: "exact" }` + `.range()`, mas trocamos pra duas
  // consultas separadas (uma com `.limit()` pros dados, outra com
  // `head: true` só pra contar) depois de ver a contagem combinada
  // divergir da real em produção (registro mais recente sumindo só
  // dessa rota). Assim cada uma é uma requisição HTTP própria e mais
  // simples, sem depender desse combo específico do PostgREST.
  function aplicarFiltro(q) {
    if (!termo) return q;
    const termoSeguro = termo.replace(/[,()]/g, " ").trim();
    const digitos = termo.replace(/\D/g, "");
    if (!termoSeguro) return q;
    return digitos.length >= 3
      ? q.or(`nome.ilike.%${termoSeguro}%,cnpj_digits.ilike.%${digitos}%`)
      : q.ilike("nome", `%${termoSeguro}%`);
  }

  const colunas =
    "id, owner_id, owner_email, nome, cnpj, responsavel_nome, plano, unidades_limite, unidades_ativas, status, stripe_subscription_id, access_note, courtesy_until, created_at";

  const [{ data: condominios, error }, { count, error: erroCount }] = await Promise.all([
    aplicarFiltro(supabaseAdmin.from("condominios").select(colunas))
      .order("created_at", { ascending: false })
      .range(from, to),
    aplicarFiltro(supabaseAdmin.from("condominios").select("id", { count: "exact", head: true })),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (erroCount) return NextResponse.json({ error: erroCount.message }, { status: 500 });

  const ownerIds = [...new Set((condominios || []).map((c) => c.owner_id))];
  const { data: contasSindico } = ownerIds.length
    ? await supabaseAdmin
        .from("contas_sindico")
        .select("user_id, pro_plus_multicondominios")
        .in("user_id", ownerIds)
    : { data: [] };
  const proPlusPorDono = new Set(
    (contasSindico || []).filter((c) => c.pro_plus_multicondominios).map((c) => c.user_id)
  );
  for (const c of condominios || []) {
    c.pro_plus_multicondominios = proPlusPorDono.has(c.owner_id);
  }

  return NextResponse.json(
    { itens: condominios || [], total: count ?? 0, page, pageSize },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}

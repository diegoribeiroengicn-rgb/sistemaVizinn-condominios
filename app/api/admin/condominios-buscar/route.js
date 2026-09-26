import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Painel admin — listagem/busca escalável de Condomínios. Busca sempre
// paginada no banco (nunca carrega a base inteira pra filtrar no
// navegador), por nome (trecho, via índice trigram) ou CNPJ com/sem
// pontuação (via a coluna gerada `cnpj_digits`, também indexada). Ver
// supabase/schema.sql.
//
// É POST (não GET) de propósito: depois de ver essa lista mostrar
// registro já apagado / faltando o mais recente mesmo com
// Cache-Control: no-store e URL sempre diferente, a suspeita é algum
// cache no meio do caminho (CDN/proxy) ignorando esses headers pra
// GET. POST não é cacheado por nada no caminho por padrão — elimina
// essa categoria inteira de causa, sem depender de nenhum header ser
// respeitado corretamente em toda a cadeia.
export async function POST(request) {
  const auth = await requireAdmin(request, "condominios");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const termo = String(body.q || "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(body.page, 10) || 1);
  const pageSize = Math.min(2000, Math.max(1, parseInt(body.pageSize, 10) || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabaseAdmin = getSupabaseAdmin();

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
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, private" } }
  );
}

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
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const termo = (searchParams.get("q") || "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from("condominios")
    .select(
      "id, owner_id, owner_email, nome, cnpj, responsavel_nome, plano, unidades_limite, unidades_ativas, status, stripe_subscription_id, access_note, courtesy_until, created_at",
      { count: "exact" }
    );

  if (termo) {
    // Vírgulas e parênteses têm significado especial na sintaxe de
    // filtro do PostgREST (.or) — tira do termo pra não quebrar a
    // consulta com um valor digitado livremente pelo admin.
    const termoSeguro = termo.replace(/[,()]/g, " ").trim();
    const digitos = termo.replace(/\D/g, "");
    if (termoSeguro) {
      query =
        digitos.length >= 3
          ? query.or(`nome.ilike.%${termoSeguro}%,cnpj_digits.ilike.%${digitos}%`)
          : query.ilike("nome", `%${termoSeguro}%`);
    }
  }

  const {
    data: condominios,
    error,
    count,
  } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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

  return NextResponse.json({ itens: condominios || [], total: count ?? 0, page, pageSize });
}

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Sem parâmetro de request, o Next tentaria pré-renderizar essa rota
// como estática em build time (e falharia, sem as env vars do
// Supabase disponíveis nesse momento). Força sempre dinâmica.
export const dynamic = "force-dynamic";

// Pública (sem login) — mostra o Ecossistema de Fornecedores Vizinn
// como diferencial na página inicial. Só dados reais da base
// (fornecedores_globais), nunca fictícios. Expõe o mínimo necessário
// pra um visitante anônimo: nome, fantasia, categoria e a reputação
// agregada (nota média + quantidade de avaliações, via
// reputacao_fornecedor_global — nunca o texto da avaliação em si, que
// continua interno ao condomínio que avaliou) de só 3 fornecedores; os
// demais ficam representados apenas como contagem por categoria, nunca
// linha a linha. Sem CNPJ, sem endereço. Restrição de verdade aqui no
// backend: o resto da base nunca sai do servidor pra ser "escondido"
// na tela.
export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("fornecedores_globais")
    .select("id, razao_social, nome_fantasia, categoria, categorias")
    .eq("status", "ativo")
    .order("razao_social", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = data?.length || 0;

  // Avalia reputação de um lote (a base começa pequena; limita mesmo
  // assim pra não crescer sem controle conforme a rede cresce) e prioriza
  // pra destaque quem já tem avaliação real — assim um fornecedor recém
  // avaliado por um síndico passa a aparecer na vitrine pública.
  const candidatos = (data || []).slice(0, 30);
  const comReputacao = await Promise.all(
    candidatos.map(async (f) => {
      const { data: rep } = await supabaseAdmin.rpc("reputacao_fornecedor_global", {
        p_fornecedor_global_id: f.id,
      });
      return { ...f, reputacao: rep?.[0] || null };
    })
  );
  comReputacao.sort((a, b) => {
    const avA = Number(a.reputacao?.total_avaliacoes || 0);
    const avB = Number(b.reputacao?.total_avaliacoes || 0);
    if (avA !== avB) return avB - avA;
    return a.razao_social.localeCompare(b.razao_social);
  });

  const destaques = comReputacao.slice(0, 3).map((f) => ({
    nome: f.nome_fantasia || f.razao_social,
    categoria: (f.categorias?.length ? f.categorias : [f.categoria].filter(Boolean)).join(", ") || null,
    notaMedia: f.reputacao?.total_avaliacoes > 0 ? Number(f.reputacao.nota_media) : null,
    totalAvaliacoes: Number(f.reputacao?.total_avaliacoes || 0),
  }));

  // Um fornecedor com mais de uma categoria conta em cada uma delas.
  const contagemPorCategoria = {};
  for (const f of data || []) {
    const categorias = f.categorias?.length ? f.categorias : [f.categoria].filter(Boolean);
    const lista = categorias.length > 0 ? categorias : ["Outros"];
    for (const cat of lista) {
      contagemPorCategoria[cat] = (contagemPorCategoria[cat] || 0) + 1;
    }
  }
  const porCategoria = Object.entries(contagemPorCategoria)
    .map(([categoria, quantidade]) => ({ categoria, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 6);

  return NextResponse.json({ total, destaques, porCategoria });
}

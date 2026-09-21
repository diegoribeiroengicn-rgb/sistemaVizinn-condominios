import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Sem parâmetro de request, o Next tentaria pré-renderizar essa rota
// como estática em build time (e falharia, sem as env vars do
// Supabase disponíveis nesse momento). Força sempre dinâmica.
export const dynamic = "force-dynamic";

// Pública (sem login) — mostra o Ecossistema de Fornecedores Vizinn
// como diferencial na página inicial. Só dados reais da base
// (fornecedores_globais), nunca fictícios. O nome do fornecedor volta
// embaçado no card (vira vantagem de assinar pra revelar); o que
// aparece limpo é a categoria/serviço e, quando existir, o texto de
// uma avaliação real — mas só quando quem avaliou marcou
// `condominio_publico` (o mesmo opt-in usado na Rede Vizinn interna).
// Nunca mostra o nome do condomínio que avaliou. Só 3 fornecedores em
// destaque; os demais ficam representados apenas como contagem por
// categoria, nunca linha a linha. Restrição de verdade aqui no
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

  const top3 = comReputacao.slice(0, 3);

  // Comentário real (só quando quem avaliou autorizou tornar a
  // avaliação pública) pra dar prova social de verdade sem inventar
  // nada e sem expor de qual condomínio veio.
  const comentarios = await Promise.all(
    top3.map(async (f) => {
      const { data: locais } = await supabaseAdmin.from("fornecedores").select("id").eq("fornecedor_global_id", f.id);
      const localIds = (locais || []).map((l) => l.id);
      if (localIds.length === 0) return null;
      const { data: avaliacao } = await supabaseAdmin
        .from("avaliacoes_fornecedor")
        .select("observacao, nota_qualidade, nota_prazo, nota_custo, nota_atendimento")
        .in("fornecedor_id", localIds)
        .eq("condominio_publico", true)
        .not("observacao", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return avaliacao || null;
    })
  );

  // O nome real do fornecedor nunca sai daqui — o card mostra só a
  // categoria e o comentário; o nome fica de propósito fora do JSON
  // (não é "manda tudo e esconde com CSS", é não mandar mesmo).
  const destaques = top3.map((f, i) => {
    const c = comentarios[i];
    return {
      categoria: (f.categorias?.length ? f.categorias : [f.categoria].filter(Boolean)).join(", ") || null,
      notaMedia: f.reputacao?.total_avaliacoes > 0 ? Number(f.reputacao.nota_media) : null,
      totalAvaliacoes: Number(f.reputacao?.total_avaliacoes || 0),
      comentario: c?.observacao || null,
    };
  });

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

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Sem parâmetro de request, o Next tentaria pré-renderizar essa rota
// como estática em build time (e falharia, sem as env vars do
// Supabase disponíveis nesse momento). Força sempre dinâmica.
export const dynamic = "force-dynamic";

// Pública (sem login) — mostra o Ecossistema de Fornecedores Vizinn
// como diferencial na página inicial. Só dados reais da base
// (fornecedores_globais), nunca fictícios. Expõe o mínimo necessário
// pra um visitante anônimo: nome, fantasia e categoria de só 3
// fornecedores (os demais ficam representados apenas como contagem por
// categoria, nunca linha a linha) — sem CNPJ, sem endereço. Restrição
// de verdade aqui no backend: o resto da base nunca sai do servidor
// pra ser "escondido" na tela.
export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("fornecedores_globais")
    .select("razao_social, nome_fantasia, categoria")
    .eq("status", "ativo")
    .order("razao_social", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = data?.length || 0;
  const destaques = (data || []).slice(0, 3).map((f) => ({
    nome: f.nome_fantasia || f.razao_social,
    categoria: f.categoria || null,
  }));

  const contagemPorCategoria = {};
  for (const f of data || []) {
    const cat = f.categoria || "Outros";
    contagemPorCategoria[cat] = (contagemPorCategoria[cat] || 0) + 1;
  }
  const porCategoria = Object.entries(contagemPorCategoria)
    .map(([categoria, quantidade]) => ({ categoria, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 6);

  return NextResponse.json({ total, destaques, porCategoria });
}

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";

// Configurações → Comissionamento: modelo padrão Vizinn + modelos
// personalizados por parceiro. Uma única engine de cálculo (ver
// lib/comissoes.js) lê os percentuais/regras daqui — nunca hardcoded.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const [{ data: modelos, error }, { data: vendedores }] = await Promise.all([
    supabaseAdmin.from("modelos_comissionamento").select("*").order("padrao", { ascending: false }).order("nome"),
    supabaseAdmin.from("vendedores").select("id, modelo_comissionamento_id"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const parceirosPorModelo = {};
  for (const v of vendedores || []) {
    if (!v.modelo_comissionamento_id) continue;
    parceirosPorModelo[v.modelo_comissionamento_id] = (parceirosPorModelo[v.modelo_comissionamento_id] || 0) + 1;
  }

  const resultado = (modelos || []).map((m) => ({ ...m, total_vendedores: parceirosPorModelo[m.id] || 0 }));
  return NextResponse.json({ modelos: resultado });
}

const CAMPOS_MODELO = [
  "nome", "descricao", "percentual_venda_propria", "percentual_indicacao", "percentual_lideranca",
  "permite_indicacao", "permite_lideranca", "meta_minima_lider", "meta_minima_equipe",
  "limite_equipe_pequena", "percentual_equipe_grande", "meta_minima_secundaria", "permite_emancipacao",
  "vigencia_inicio", "vigencia_fim",
];

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

  const payload = { nome: body.nome.trim() };
  for (const campo of CAMPOS_MODELO) {
    if (campo !== "nome" && campo in body) payload[campo] = body[campo];
  }

  // Duplicar um modelo existente: copia os campos de regra dele como
  // base, mas nasce como versão 1 de um modelo novo e independente —
  // nunca compartilha histórico com o original.
  if (body.duplicarDeId) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: origem } = await supabaseAdmin.from("modelos_comissionamento").select("*").eq("id", body.duplicarDeId).maybeSingle();
    if (origem) {
      for (const campo of CAMPOS_MODELO) {
        if (campo !== "nome" && !(campo in body)) payload[campo] = origem[campo];
      }
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("modelos_comissionamento")
    .insert({ ...payload, padrao: false, versao: 1 })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaAdmin(supabaseAdmin, {
    adminUser: auth.user,
    acao: "criar",
    entidade: "modelo_comissionamento",
    entidadeId: data.id,
    dadosNovos: data,
  });

  return NextResponse.json({ modelo: data });
}

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Controle do Nível de Destaque Comercial de um fornecedor da base
// geral — informação exclusiva do painel admin (nunca exposta a
// fornecedor/condomínio/morador; ver fornecedores_destaque_comercial
// em supabase/schema.sql, sem policy nenhuma pra "authenticated"). A
// nota do fornecedor nunca é tocada aqui — isso só grava o nível, a
// situação de pagamento e a vigência usados pra ORDENAR a Rede de
// Fornecedores Vizinn (ver função buscar_fornecedores_rede no banco).
const NIVEIS_VALIDOS = [0, 1, 2, 3];
const SITUACOES_VALIDAS = ["pendente", "pago", "vencido", "cancelado"];

export async function GET(request, { params }) {
  const auth = await requireAdmin(request, "fornecedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseAdmin = getSupabaseAdmin();
  const [{ data: destaque, error: destaqueError }, { data: historico, error: historicoError }] = await Promise.all([
    supabaseAdmin
      .from("fornecedores_destaque_comercial")
      .select("*")
      .eq("fornecedor_global_id", params.id)
      .maybeSingle(),
    supabaseAdmin
      .from("fornecedores_destaque_historico")
      .select("*")
      .eq("fornecedor_global_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (destaqueError) return NextResponse.json({ error: destaqueError.message }, { status: 500 });
  if (historicoError) return NextResponse.json({ error: historicoError.message }, { status: 500 });

  return NextResponse.json({ destaque: destaque || null, historico: historico || [] });
}

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request, "fornecedores");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const nivel = Number(body.nivel);
  const situacaoPagamento = body.situacaoPagamento;
  const destaqueAtivo = Boolean(body.destaqueAtivo);
  const dataInicio = body.dataInicio || null;
  const dataFim = body.dataFim || null;
  const observacoes = body.observacoes?.trim() || null;

  if (!NIVEIS_VALIDOS.includes(nivel)) {
    return NextResponse.json({ error: "Nível de destaque inválido." }, { status: 400 });
  }
  if (!SITUACOES_VALIDAS.includes(situacaoPagamento)) {
    return NextResponse.json({ error: "Situação de pagamento inválida." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: fornecedorGlobal } = await supabaseAdmin
    .from("fornecedores_globais")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();
  if (!fornecedorGlobal) {
    return NextResponse.json({ error: "Fornecedor não encontrado na base geral." }, { status: 404 });
  }

  const { data: atual } = await supabaseAdmin
    .from("fornecedores_destaque_comercial")
    .select("*")
    .eq("fornecedor_global_id", params.id)
    .maybeSingle();

  const { data: salvo, error } = await supabaseAdmin
    .from("fornecedores_destaque_comercial")
    .upsert(
      {
        fornecedor_global_id: params.id,
        nivel,
        situacao_pagamento: situacaoPagamento,
        destaque_ativo: destaqueAtivo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        observacoes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "fornecedor_global_id" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mudou =
    !atual ||
    atual.nivel !== nivel ||
    atual.situacao_pagamento !== situacaoPagamento ||
    atual.destaque_ativo !== destaqueAtivo;

  if (mudou) {
    await supabaseAdmin.from("fornecedores_destaque_historico").insert({
      fornecedor_global_id: params.id,
      alterado_por: auth.user.id,
      alterado_por_email: auth.user.email,
      nivel_anterior: atual?.nivel ?? null,
      nivel_novo: nivel,
      situacao_pagamento_anterior: atual?.situacao_pagamento ?? null,
      situacao_pagamento_novo: situacaoPagamento,
      destaque_ativo_anterior: atual?.destaque_ativo ?? null,
      destaque_ativo_novo: destaqueAtivo,
    });
  }

  return NextResponse.json({ destaque: salvo });
}

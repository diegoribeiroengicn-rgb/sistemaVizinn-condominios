import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Expõe pro condômino só as contas a receber da própria unidade —
// os dados já existem em contas_receber (emitidos pelo síndico via
// /api/financeiro/emitir-boleto), falta só deixar o condômino ver.
// Usa service role porque isso não é acesso ao módulo "financeiro"
// (que é do síndico/subsíndico/administrador): é o condômino vendo o
// que é dele mesmo, então a filtragem por unidade é feita aqui.
export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const condominioId = new URL(request.url).searchParams.get("condominioId");

  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!condominioId) return NextResponse.json({ error: "condominioId é obrigatório." }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  const { data: membro, error: membroError } = await supabaseAdmin
    .from("membros")
    .select("id, unidade")
    .eq("condominio_id", condominioId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (membroError) return NextResponse.json({ error: membroError.message }, { status: 500 });
  if (!membro?.unidade) {
    return NextResponse.json({ error: "Sua unidade não está cadastrada — fale com o síndico." }, { status: 400 });
  }

  const { data: contas, error: contasError } = await supabaseAdmin
    .from("contas_receber")
    .select("id, descricao, valor, valor_recebido, data_vencimento, data_recebimento, status, forma_pagamento, boleto_url, boleto_linha_digitavel")
    .eq("condominio_id", condominioId)
    .eq("unidade", membro.unidade)
    .order("data_vencimento", { ascending: false, nullsFirst: false });
  if (contasError) return NextResponse.json({ error: contasError.message }, { status: 500 });

  const contaIds = (contas || []).map((c) => c.id);
  let itensPorConta = {};
  if (contaIds.length > 0) {
    const { data: itens, error: itensError } = await supabaseAdmin
      .from("contas_receber_itens")
      .select("conta_receber_id, descricao, valor")
      .in("conta_receber_id", contaIds);
    if (itensError) return NextResponse.json({ error: itensError.message }, { status: 500 });
    itensPorConta = (itens || []).reduce((acc, it) => {
      (acc[it.conta_receber_id] = acc[it.conta_receber_id] || []).push({ descricao: it.descricao, valor: it.valor });
      return acc;
    }, {});
  }

  return NextResponse.json({
    contas: (contas || []).map((c) => ({ ...c, itens: itensPorConta[c.id] || [] })),
  });
}

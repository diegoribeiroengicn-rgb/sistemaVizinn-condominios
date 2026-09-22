import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

// Platform-owner-only: contas a pagar/receber do próprio Vizinn (a
// empresa, não os condomínios). Tabela vizinn_lancamentos não tem
// policy pra ninguém além do service_role — acesso gated só por
// requireAdmin().
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin.from("vizinn_lancamentos").select("*").order("data_vencimento", { ascending: true });
  if (tipo === "pagar" || tipo === "receber") query = query.eq("tipo", tipo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lancamentos: data || [] });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const { tipo, descricao, categoria, valor, dataVencimento, dataPagamento, status, recorrente, observacoes } = body || {};

  if (!["pagar", "receber"].includes(tipo)) {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }
  if (!descricao?.trim() || valor == null || valor === "") {
    return NextResponse.json({ error: "Preencha descrição e valor." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("vizinn_lancamentos")
    .insert({
      tipo,
      descricao: descricao.trim(),
      categoria: categoria || null,
      valor: Number(valor),
      data_vencimento: dataVencimento || null,
      data_pagamento: dataPagamento || null,
      status: status || "pendente",
      recorrente: Boolean(recorrente),
      observacoes: observacoes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lancamento: data });
}

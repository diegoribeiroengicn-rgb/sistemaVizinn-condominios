import { NextResponse } from "next/server";
import { requireCondominioAccess } from "@/lib/memberAuth";
import { garantirClienteAsaas, emitirBoleto } from "@/lib/asaas";
import { registrarAuditoria } from "@/lib/auditoria";

// Emite um boleto de verdade (Asaas) pra uma conta a receber já
// cadastrada. Precisa da subconta do condomínio ativa (ver
// /api/financeiro/asaas-subconta) e do CPF/CNPJ do pagador preenchido
// na própria conta a receber.
export async function POST(request) {
  const { condominioId, contaReceberId } = await request.json().catch(() => ({}));
  const auth = await requireCondominioAccess(request, condominioId, "financeiro", "editar");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin, user, isOwner, membro } = auth;

  const { data: conta, error: contaError } = await supabaseAdmin
    .from("contas_receber")
    .select("id, descricao, valor, data_vencimento, pagador_cpf_cnpj, pagador_email, responsavel_financeiro")
    .eq("id", contaReceberId)
    .eq("condominio_id", condominioId)
    .maybeSingle();
  if (contaError) return NextResponse.json({ error: contaError.message }, { status: 500 });
  if (!conta) return NextResponse.json({ error: "Conta a receber não encontrada." }, { status: 404 });
  if (!conta.pagador_cpf_cnpj) {
    return NextResponse.json({ error: "Preencha o CPF/CNPJ do pagador nesta conta antes de emitir o boleto." }, { status: 400 });
  }
  if (!conta.data_vencimento) {
    return NextResponse.json({ error: "Preencha a data de vencimento antes de emitir o boleto." }, { status: 400 });
  }

  const { data: subconta, error: subcontaError } = await supabaseAdmin
    .from("condominios_asaas")
    .select("api_key, status")
    .eq("condominio_id", condominioId)
    .maybeSingle();
  if (subcontaError) return NextResponse.json({ error: subcontaError.message }, { status: 500 });
  if (!subconta || subconta.status !== "ativa") {
    return NextResponse.json({ error: "Ative a cobrança via boleto pra este condomínio antes de emitir." }, { status: 400 });
  }

  let customerId, boleto;
  try {
    customerId = await garantirClienteAsaas(subconta.api_key, {
      nome: conta.responsavel_financeiro || "Morador",
      cpfCnpj: conta.pagador_cpf_cnpj,
      email: conta.pagador_email,
    });
    boleto = await emitirBoleto(subconta.api_key, {
      customerId,
      valor: conta.valor,
      vencimento: conta.data_vencimento,
      descricao: conta.descricao,
    });
  } catch (err) {
    return NextResponse.json({ error: `Asaas recusou a emissão do boleto: ${err.message}` }, { status: 502 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("contas_receber")
    .update({
      asaas_customer_id: customerId,
      asaas_charge_id: boleto.chargeId,
      boleto_url: boleto.boletoUrl,
      boleto_linha_digitavel: boleto.linhaDigitavel,
      forma_pagamento: "Boleto",
    })
    .eq("id", contaReceberId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await registrarAuditoria(supabaseAdmin, {
    condominioId,
    usuarioId: user.id,
    usuarioNome: isOwner ? "Síndico" : membro?.nome,
    papel: isOwner ? "sindico" : membro?.papel,
    acao: "emitir_boleto",
    modulo: "financeiro",
    registroId: contaReceberId,
    dadosNovos: { asaas_charge_id: boleto.chargeId },
  });

  return NextResponse.json({ success: true, boletoUrl: boleto.boletoUrl, linhaDigitavel: boleto.linhaDigitavel });
}

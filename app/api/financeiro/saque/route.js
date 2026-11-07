import { NextResponse } from "next/server";
import { requireCondominioOwner } from "@/lib/memberAuth";
import { criarTransferencia } from "@/lib/asaas";
import { registrarAuditoria } from "@/lib/auditoria";

// Transfere o saldo da subconta Asaas do condomínio pra fora (PIX ou
// conta bancária) — só o síndico (dono do condomínio) pode pedir, nunca
// um membro delegado, por mover dinheiro de verdade pra fora do sistema.
export async function POST(request) {
  const { condominioId, valor, pixAddressKey, contaBancaria } = await request.json().catch(() => ({}));
  const auth = await requireCondominioOwner(request, condominioId);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin, user } = auth;

  if (!valor || valor <= 0) return NextResponse.json({ error: "Informe um valor válido pra sacar." }, { status: 400 });
  if (!pixAddressKey && !contaBancaria) {
    return NextResponse.json({ error: "Informe uma chave PIX ou os dados da conta bancária." }, { status: 400 });
  }

  const { data: subconta, error: subcontaError } = await supabaseAdmin
    .from("condominios_asaas")
    .select("api_key, status")
    .eq("condominio_id", condominioId)
    .maybeSingle();
  if (subcontaError) return NextResponse.json({ error: subcontaError.message }, { status: 500 });
  if (!subconta || subconta.status !== "ativa") {
    return NextResponse.json({ error: "A cobrança via boleto não está ativa pra este condomínio." }, { status: 400 });
  }

  let transferencia;
  try {
    transferencia = await criarTransferencia(subconta.api_key, { valor, pixAddressKey, contaBancaria });
  } catch (err) {
    return NextResponse.json({ error: `Asaas recusou a transferência: ${err.message}` }, { status: 502 });
  }

  await registrarAuditoria(supabaseAdmin, {
    condominioId,
    usuarioId: user.id,
    usuarioNome: "Síndico",
    papel: "sindico",
    acao: "sacar_saldo_boleto",
    modulo: "financeiro",
    dadosNovos: { valor, transfer_id: transferencia.transferId, status: transferencia.status },
  });

  return NextResponse.json({ success: true, status: transferencia.status });
}

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verificarTokenWebhook } from "@/lib/asaas";

// Recebe os eventos de pagamento do Asaas (configurado no painel deles,
// apontando pra https://SEU_DOMINIO/api/webhook-asaas, com o mesmo token
// em ASAAS_WEBHOOK_TOKEN). Fluxo normal de um boleto pago em dia:
// PAYMENT_CREATED -> PAYMENT_CONFIRMED (pago, mas saldo ainda não
// liberado) -> PAYMENT_RECEIVED (saldo disponível). Só marca a conta
// como "recebida" em RECEIVED, pra não contar dinheiro que ainda não
// está de fato disponível na subconta.
//
// Todo UPDATE aqui é por asaas_charge_id, então reenvio do mesmo
// evento (o Asaas reenvia em caso de erro/timeout nosso) é idempotente
// de verdade — rodar duas vezes com os mesmos dados não muda nada
// além da primeira vez.
export async function POST(request) {
  if (!verificarTokenWebhook(request)) {
    return NextResponse.json({ error: "Token de webhook inválido." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const evento = body?.event;
  const chargeId = body?.payment?.id;
  if (!evento || !chargeId) return NextResponse.json({ ok: true });

  const supabaseAdmin = getSupabaseAdmin();

  if (evento === "PAYMENT_RECEIVED") {
    const { error } = await supabaseAdmin
      .from("contas_receber")
      .update({
        status: "recebida",
        data_recebimento: new Date().toISOString().slice(0, 10),
        valor_recebido: body.payment.value,
      })
      .eq("asaas_charge_id", chargeId);
    if (error) console.error("Erro ao marcar conta como recebida (webhook Asaas):", error.message);
  }

  // Vencida: só sobrescreve se a conta ainda não tiver um status final
  // (recebida/cancelada) — um OVERDUE atrasado na fila não pode
  // reabrir uma conta que já foi paga ou cancelada depois dele.
  if (evento === "PAYMENT_OVERDUE") {
    const { error } = await supabaseAdmin
      .from("contas_receber")
      .update({ status: "vencida" })
      .eq("asaas_charge_id", chargeId)
      .not("status", "in", "(recebida,cancelada)");
    if (error) console.error("Erro ao marcar conta como vencida (webhook Asaas):", error.message);
  }

  // Estorno/cancelamento sempre sobrescreve, mesmo uma conta já
  // "recebida" — é exatamente o caso de uso (dinheiro que tinha
  // entrado, voltou).
  if (evento === "PAYMENT_REFUNDED" || evento === "PAYMENT_DELETED") {
    const { error } = await supabaseAdmin
      .from("contas_receber")
      .update({ status: "cancelada" })
      .eq("asaas_charge_id", chargeId);
    if (error) console.error("Erro ao marcar conta como cancelada (webhook Asaas):", error.message);
  }

  // Responde 2xx rápido sempre que o token bateu — o Asaas reenvia em
  // caso de erro, e eventos que não tratamos aqui (CONFIRMED, etc.)
  // não precisam de ação nossa agora.
  return NextResponse.json({ ok: true });
}

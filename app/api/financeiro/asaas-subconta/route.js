import { NextResponse } from "next/server";
import { requireCondominioAccess } from "@/lib/memberAuth";
import { ativarCobrancaBoleto, consultarSaldo } from "@/lib/asaas";
import { registrarAuditoria } from "@/lib/auditoria";

// Ativa a cobrança via boleto pra um condomínio (botão manual, usado
// pelos condomínios que já existiam antes da ativação ser automática no
// cadastro — ver complete-signup/dev-signup). Idempotente.
export async function POST(request) {
  const { condominioId } = await request.json().catch(() => ({}));
  const auth = await requireCondominioAccess(request, condominioId, "financeiro", "criar");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin, user, isOwner, membro } = auth;

  const resultado = await ativarCobrancaBoleto(supabaseAdmin, condominioId);
  if (!resultado.ok) return NextResponse.json({ error: resultado.motivo }, { status: 400 });
  if (resultado.jaAtiva) {
    return NextResponse.json({ success: true, aviso: "Cobrança via boleto já está ativa pra este condomínio." });
  }

  await registrarAuditoria(supabaseAdmin, {
    condominioId,
    usuarioId: user.id,
    usuarioNome: isOwner ? "Síndico" : membro?.nome,
    papel: isOwner ? "sindico" : membro?.papel,
    acao: "ativar_boleto",
    modulo: "financeiro",
    dadosNovos: { account_id: resultado.accountId },
  });

  return NextResponse.json({ success: true });
}

// Status + saldo atual (pra mostrar na tela de Financeiro).
export async function GET(request) {
  const condominioId = new URL(request.url).searchParams.get("condominioId");
  const auth = await requireCondominioAccess(request, condominioId, "financeiro", "visualizar");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const { data: conta, error } = await supabaseAdmin
    .from("condominios_asaas")
    .select("status, api_key")
    .eq("condominio_id", condominioId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!conta || conta.status !== "ativa") return NextResponse.json({ ativo: false });

  let saldo = null;
  try {
    saldo = await consultarSaldo(conta.api_key);
  } catch {
    // Saldo é só informativo na tela — se o Asaas estiver fora do ar,
    // não trava a página de Financeiro por isso.
  }

  return NextResponse.json({ ativo: true, saldo });
}

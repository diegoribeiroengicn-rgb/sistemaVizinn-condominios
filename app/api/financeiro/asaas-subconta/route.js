import { NextResponse } from "next/server";
import { requireCondominioAccess } from "@/lib/memberAuth";
import { criarSubconta, consultarSaldo } from "@/lib/asaas";
import { registrarAuditoria } from "@/lib/auditoria";

// Ativa a cobrança via boleto pra um condomínio: cria a subconta dele no
// Asaas e guarda a api_key (server-only, ver condominios_asaas no schema).
// Idempotente — se já existe uma subconta ativa, só retorna ela.
export async function POST(request) {
  const { condominioId } = await request.json().catch(() => ({}));
  const auth = await requireCondominioAccess(request, condominioId, "financeiro", "criar");
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin, user, isOwner, membro } = auth;

  const { data: existente } = await supabaseAdmin
    .from("condominios_asaas")
    .select("status")
    .eq("condominio_id", condominioId)
    .maybeSingle();
  if (existente?.status === "ativa") {
    return NextResponse.json({ success: true, aviso: "Cobrança via boleto já está ativa pra este condomínio." });
  }

  const { data: condominio, error: condoError } = await supabaseAdmin
    .from("condominios")
    .select("nome, cnpj, endereco, owner_email, responsavel_telefone")
    .eq("id", condominioId)
    .maybeSingle();
  if (condoError) return NextResponse.json({ error: condoError.message }, { status: 500 });
  if (!condominio) return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 404 });
  if (!condominio.cnpj) return NextResponse.json({ error: "Cadastre o CNPJ do condomínio em Configurações antes de ativar o boleto." }, { status: 400 });
  if (!condominio.owner_email) return NextResponse.json({ error: "Condomínio sem e-mail do síndico cadastrado." }, { status: 400 });

  let subconta;
  try {
    subconta = await criarSubconta({
      nome: condominio.nome,
      email: condominio.owner_email,
      cpfCnpj: condominio.cnpj,
      telefone: condominio.responsavel_telefone,
      endereco: condominio.endereco,
    });
  } catch (err) {
    return NextResponse.json({ error: `Asaas recusou a criação da subconta: ${err.message}` }, { status: 502 });
  }

  const { error: upsertError } = await supabaseAdmin.from("condominios_asaas").upsert({
    condominio_id: condominioId,
    account_id: subconta.accountId,
    wallet_id: subconta.walletId,
    api_key: subconta.apiKey,
    status: "ativa",
    updated_at: new Date().toISOString(),
  });
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  await registrarAuditoria(supabaseAdmin, {
    condominioId,
    usuarioId: user.id,
    usuarioNome: isOwner ? condominio.nome : membro?.nome,
    papel: isOwner ? "sindico" : membro?.papel,
    acao: "ativar_boleto",
    modulo: "financeiro",
    dadosNovos: { account_id: subconta.accountId },
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

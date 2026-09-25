import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireVendedor } from "@/lib/vendedorAuth";
import { getStripe } from "@/lib/stripe";
import { getPlan, getStripePriceId, TRIAL_PERIOD_DAYS } from "@/lib/plans";
import { gerarComissoesParaVenda } from "@/lib/comissoes";
import { registrarAuditoriaAdmin } from "@/lib/adminAuditoria";

// Vendedor cadastra uma venda fechada diretamente (fora do checkout
// público de autoatendimento) — ele digita o valor da adesão
// combinado com o síndico, o condomínio já nasce atribuído a esse
// vendedor (vendedor_id) e o motor de comissões roda automaticamente
// (a mesma função que o cadastro público usa — gerarComissoesParaVenda,
// nenhuma lógica duplicada). Não manda e-mail nenhum pro síndico — o
// vendedor tem autonomia total sobre essa comunicação: a gente só
// gera o link de definir senha e devolve na resposta, pro vendedor
// copiar e mandar do jeito e na hora que ele quiser.
export async function POST(request) {
  const auth = await requireVendedor(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const {
    condominioNome,
    cnpj,
    endereco,
    responsavelNome,
    responsavelEmail,
    responsavelTelefone,
    planoId,
    valorAdesao,
  } = body;

  if (!condominioNome?.trim() || !responsavelNome?.trim() || !responsavelEmail?.trim() || !planoId) {
    return NextResponse.json(
      { error: "Nome do condomínio, responsável, e-mail e plano são obrigatórios." },
      { status: 400 }
    );
  }
  const valor = Number(valorAdesao);
  if (!Number.isFinite(valor) || valor < 0) {
    return NextResponse.json({ error: "Valor da adesão inválido." }, { status: 400 });
  }

  const plan = getPlan(planoId);
  const supabaseAdmin = auth.supabaseAdmin;
  const emailNormalizado = responsavelEmail.trim().toLowerCase();

  try {
    const { data: userData, error: erroCriarUser } = await supabaseAdmin.auth.admin.createUser({
      email: emailNormalizado,
      password: randomUUID(),
      email_confirm: true,
      user_metadata: { full_name: responsavelNome.trim(), phone: responsavelTelefone || null },
    });
    if (erroCriarUser) {
      if (erroCriarUser.message?.toLowerCase().includes("already")) {
        return NextResponse.json({ error: "Já existe uma conta com este e-mail no Vizinn." }, { status: 409 });
      }
      return NextResponse.json({ error: erroCriarUser.message }, { status: 500 });
    }
    const ownerId = userData.user.id;

    // Assinatura mensal normal no Stripe (com trial), igual o
    // autoatendimento — só a taxa de adesão em si é registrada manual
    // aqui em vez de cobrada por cartão na hora, porque o vendedor já
    // fechou isso por fora. Se o Stripe não estiver configurado, segue
    // sem assinatura (mesmo comportamento do cadastro público).
    let customer = null;
    let subscription = null;
    try {
      const stripe = getStripe();
      customer = await stripe.customers.create({
        email: emailNormalizado,
        name: responsavelNome.trim(),
        phone: responsavelTelefone || undefined,
        metadata: { condominioNome, cnpj: cnpj || "", vendedorId: auth.vendedor.id },
      });
      const priceId = getStripePriceId(plan.id);
      if (priceId) {
        subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: priceId }],
          trial_period_days: TRIAL_PERIOD_DAYS,
          metadata: { planId: plan.id },
        });
      }
    } catch (erroStripe) {
      console.error("Stripe indisponível ao cadastrar condomínio pelo vendedor:", erroStripe);
    }

    const { data: condoRow, error: condoError } = await supabaseAdmin
      .from("condominios")
      .insert({
        owner_id: ownerId,
        owner_email: emailNormalizado,
        nome: condominioNome.trim(),
        cnpj: cnpj?.trim() || null,
        endereco: endereco?.trim() || null,
        responsavel_nome: responsavelNome.trim(),
        responsavel_telefone: responsavelTelefone?.trim() || null,
        plano: plan.id,
        unidades_limite: plan.unitLimit,
        stripe_customer_id: customer?.id || null,
        stripe_subscription_id: subscription?.id || null,
        status: subscription ? subscription.status : "trialing",
        vendedor_id: auth.vendedor.id,
        taxa_adesao_paga: valor,
      })
      .select("id")
      .single();

    if (condoError) {
      return NextResponse.json({ error: `Erro ao salvar o condomínio: ${condoError.message}` }, { status: 500 });
    }

    try {
      await gerarComissoesParaVenda(supabaseAdmin, condoRow.id);
    } catch (erroComissao) {
      console.error("Erro ao gerar comissões da venda cadastrada pelo vendedor:", erroComissao);
    }

    // Só gera o link — não manda e-mail nenhum. O vendedor decide
    // como e quando avisar o síndico (WhatsApp etc.), sem depender do
    // Resend nem esperar nenhum e-mail chegar.
    let actionLink = null;
    try {
      const origin = new URL(request.url).origin;
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: emailNormalizado,
        options: { redirectTo: `${origin}/redefinir-senha` },
      });
      actionLink = linkData?.properties?.action_link || null;
    } catch (erroLink) {
      console.error("Erro ao gerar link de definir senha:", erroLink);
    }

    await registrarAuditoriaAdmin(supabaseAdmin, {
      adminUser: auth.user,
      acao: "cadastrar_condominio_por_vendedor",
      entidade: "condominio",
      entidadeId: condoRow.id,
      dadosNovos: { nome: condominioNome.trim(), valorAdesao: valor, vendedorId: auth.vendedor.id, vendedorNome: auth.vendedor.nome },
    });

    return NextResponse.json({ success: true, condominioId: condoRow.id, actionLink });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Erro ao cadastrar condomínio." }, { status: 500 });
  }
}

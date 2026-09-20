import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPlan, getStripePriceId, TRIAL_PERIOD_DAYS } from "@/lib/plans";

// Finalizes signup after the R$ 1 card-validation payment succeeded:
// 1) creates/loads the Stripe customer and attaches the confirmed card
// 2) creates the subscription for the chosen plan (with a 14-day trial)
// 3) creates the Supabase auth user
// 4) creates the "condominios" row linked to that user
export async function POST(request) {
  const body = await request.json();
  const {
    paymentIntentId,
    email,
    password,
    fullName,
    phone,
    planId,
    condominioNome,
    cnpj,
    endereco,
  } = body;

  if (!paymentIntentId || !email || !password || !condominioNome) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes." }, { status: 400 });
  }

  const plan = getPlan(planId);
  let stripe;
  let supabaseAdmin;
  try {
    stripe = getStripe();
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    console.error("Configuração ausente:", err);
    return NextResponse.json(
      { error: "Integração não configurada no servidor. Contate o suporte." },
      { status: 500 }
    );
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Pagamento de validação não foi confirmado." },
        { status: 400 }
      );
    }

    const paymentMethodId = paymentIntent.payment_method;

    const existing = await stripe.customers.list({ email, limit: 1 });
    const customer =
      existing.data[0] ||
      (await stripe.customers.create({
        email,
        name: fullName,
        phone: phone || undefined,
        metadata: { condominioNome, cnpj: cnpj || "" },
      }));

    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    let subscription = null;
    const priceId = getStripePriceId(plan.id);
    if (priceId) {
      subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        trial_period_days: TRIAL_PERIOD_DAYS,
        metadata: { planId: plan.id },
      });
    } else {
      console.warn(`Sem price id para o plano "${plan.id}" (env ${plan.priceEnv}); assinatura não criada.`);
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: phone || null },
    });

    if (userError) {
      if (userError.message?.toLowerCase().includes("already")) {
        return NextResponse.json(
          { error: "Já existe uma conta com este e-mail." },
          { status: 409 }
        );
      }
      throw userError;
    }

    const ownerId = userData.user.id;

    const { error: condoError } = await supabaseAdmin.from("condominios").insert({
      owner_id: ownerId,
      owner_email: email,
      nome: condominioNome,
      cnpj: cnpj || null,
      endereco: endereco || null,
      responsavel_nome: fullName,
      responsavel_telefone: phone || null,
      plano: plan.id,
      unidades_limite: plan.unitLimit,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription?.id || null,
      status: subscription ? subscription.status : "trialing",
    });

    if (condoError) {
      console.error("Erro ao criar condomínio:", condoError);
      return NextResponse.json(
        { error: "Conta criada, mas houve um erro ao salvar os dados do condomínio." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, userId: ownerId });
  } catch (err) {
    console.error("complete-signup error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível concluir o cadastro." },
      { status: 500 }
    );
  }
}

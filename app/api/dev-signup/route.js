import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPlan } from "@/lib/plans";

// Test-mode only: creates the Supabase user + condominio row WITHOUT
// touching Stripe at all (no card, no charge, no subscription). Meant for
// developing/validating the app before going live. Gated behind
// ALLOW_TEST_SIGNUP so it can never run unless explicitly turned on, and
// should be turned off (or removed) before onboarding real customers.
export async function POST(request) {
  if (process.env.ALLOW_TEST_SIGNUP !== "true") {
    return NextResponse.json(
      { error: "Cadastro de teste desabilitado (ALLOW_TEST_SIGNUP != true)." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { email, password, fullName, phone, planId, condominioNome, cnpj, endereco } = body;

  if (!email || !password || !condominioNome) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes." }, { status: 400 });
  }

  const plan = getPlan(planId);
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    console.error("Configuração ausente:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  try {
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
      stripe_customer_id: null,
      stripe_subscription_id: null,
      status: "trialing",
    });

    if (condoError) {
      console.error("Erro ao criar condomínio (teste):", condoError);
      return NextResponse.json(
        { error: "Conta criada, mas houve um erro ao salvar os dados do condomínio." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, userId: ownerId });
  } catch (err) {
    console.error("dev-signup error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível concluir o cadastro de teste." },
      { status: 500 }
    );
  }
}

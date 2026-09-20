import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { CARD_VALIDATION_AMOUNT_CENTS, getPlan } from "@/lib/plans";

// Creates a small PaymentIntent (R$ 1,00) used to validate the customer's
// card during signup. The full subscription is created afterwards in
// /api/complete-signup, once the card has been confirmed.
export async function POST(request) {
  try {
    const { planId, email } = await request.json();
    const plan = getPlan(planId);

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: CARD_VALIDATION_AMOUNT_CENTS,
      currency: "brl",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      receipt_email: email || undefined,
      description: `Vizinn - Validação de cartão (plano ${plan.name})`,
      metadata: { planId: plan.id, purpose: "signup_card_validation" },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("create-payment-intent error:", err);
    return NextResponse.json(
      { error: err.message || "Não foi possível iniciar o pagamento." },
      { status: 500 }
    );
  }
}

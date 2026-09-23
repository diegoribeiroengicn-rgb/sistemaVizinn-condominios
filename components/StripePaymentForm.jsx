"use client";

import { useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

// Embedded Stripe Elements form. Rendered inside an <Elements> provider by
// SignupForm once a PaymentIntent client secret has been fetched.
export default function StripePaymentForm({ onSuccess, onBack, submitting, setSubmitting }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setError("");
    setSubmitting(true);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message);
      setSubmitting(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Não foi possível validar o cartão.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      onSuccess(paymentIntent);
    } else {
      setError("Pagamento não confirmado. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement options={{ layout: "tabs" }} />

      {error && <p className="text-sm text-coral-700">{error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button type="button" onClick={onBack} className="btn-secondary" disabled={submitting}>
          Voltar
        </button>
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="btn-primary flex-1"
        >
          {submitting ? "Processando..." : "Pagar adesão e criar conta"}
        </button>
      </div>
    </form>
  );
}

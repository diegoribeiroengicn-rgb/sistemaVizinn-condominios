"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { getStripeClient } from "@/lib/stripeClient";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { PLANS } from "@/lib/plans";
import { calcularAdesaoComCupom } from "@/lib/cupons";
import StripePaymentForm from "@/components/StripePaymentForm";

const STEPS = { DADOS: "dados", PAGAMENTO: "pagamento", SUCESSO: "sucesso" };

// Shows the "pular pagamento" test-mode button. The server-side
// /api/dev-signup route re-checks ALLOW_TEST_SIGNUP independently, so this
// flag only controls whether the button is visible — it can't bypass the
// real gate on its own.
const TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE === "true";

const emptyForm = {
  email: "",
  password: "",
  fullName: "",
  phone: "",
  condominioNome: "",
  cnpj: "",
  endereco: "",
};

export default function SignupForm({ initialPlan = "growth", onClose }) {
  const router = useRouter();
  const [step, setStep] = useState(STEPS.DADOS);
  const [form, setForm] = useState(emptyForm);
  const [planId, setPlanId] = useState(initialPlan);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [taxasAdesao, setTaxasAdesao] = useState({});
  const [cupomInput, setCupomInput] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState(null); // { codigo, tipo, valor }
  const [validandoCupom, setValidandoCupom] = useState(false);
  const [erroCupom, setErroCupom] = useState("");

  useEffect(() => {
    setPlanId(initialPlan);
  }, [initialPlan]);

  useEffect(() => {
    fetch("/api/public/taxas-adesao")
      .then((res) => res.json())
      .then((data) => setTaxasAdesao(data.taxas || {}))
      .catch(() => {});
  }, []);

  async function aplicarCupom() {
    if (!cupomInput.trim()) return;
    setValidandoCupom(true);
    setErroCupom("");
    try {
      const res = await fetch(`/api/public/validar-cupom?codigo=${encodeURIComponent(cupomInput.trim())}`);
      const data = await res.json();
      if (!data.valido) {
        setErroCupom(data.error || "Cupom inválido.");
        setCupomAplicado(null);
        return;
      }
      setCupomAplicado({ codigo: data.codigo, tipo: data.tipo, valor: data.valor });
    } catch {
      setErroCupom("Não foi possível validar o cupom agora.");
    } finally {
      setValidandoCupom(false);
    }
  }

  const stripePromise = useMemo(() => getStripeClient(), []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validateDados() {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Informe um e-mail válido.";
    if (form.password.length < 6) next.password = "A senha deve ter ao menos 6 caracteres.";
    if (!form.fullName.trim()) next.fullName = "Informe seu nome completo.";
    if (!form.condominioNome.trim()) next.condominioNome = "Informe o nome do condomínio.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleDadosSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!validateDados()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, email: form.email, cupomCodigo: cupomAplicado?.codigo || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao iniciar pagamento.");

      if (data.isento) {
        await finalizarCadastro({ isento: true });
        return;
      }

      setClientSecret(data.clientSecret);
      setStep(STEPS.PAGAMENTO);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function finalizarCadastro({ paymentIntentId, isento }) {
    setFormError("");
    try {
      const res = await fetch("/api/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          planId,
          paymentIntentId,
          isento: isento || false,
          cupomCodigo: cupomAplicado?.codigo || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao concluir cadastro.");
      setStep(STEPS.SUCESSO);
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  async function handleTestSignup() {
    setFormError("");
    if (!validateDados()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/dev-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar conta de teste.");
      setStep(STEPS.SUCESSO);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePaymentSuccess(paymentIntent) {
    await finalizarCadastro({ paymentIntentId: paymentIntent.id });
  }

  // Auto-login + redirect once the success screen is shown.
  useEffect(() => {
    if (step !== STEPS.SUCESSO) return;

    const tick = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    const finish = setTimeout(async () => {
      if (isSupabaseConfigured) {
        await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
      }
      router.push("/dashboard");
    }, 3000);

    return () => {
      clearInterval(tick);
      clearTimeout(finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const selectedPlan = PLANS.find((p) => p.id === planId) ?? PLANS[1];

  return (
    <div className="card mx-auto w-full max-w-xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-navy-900">Criar conta Vizinn</h2>
        {onClose && (
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700" aria-label="Fechar">
            ✕
          </button>
        )}
      </div>

      {step === STEPS.DADOS && (
        <form onSubmit={handleDadosSubmit} className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
              Dados pessoais
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label-field">E-mail</label>
                <input
                  className="input-field"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="voce@email.com"
                />
                {errors.email && <p className="mt-1 text-xs text-coral-700">{errors.email}</p>}
              </div>
              <div>
                <label className="label-field">Senha</label>
                <input
                  className="input-field"
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-coral-700">{errors.password}</p>
                )}
              </div>
              <div>
                <label className="label-field">Nome completo</label>
                <input
                  className="input-field"
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  placeholder="Seu nome"
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-coral-700">{errors.fullName}</p>
                )}
              </div>
              <div>
                <label className="label-field">Telefone</label>
                <input
                  className="input-field"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
              Dados do condomínio
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label-field">Nome do condomínio</label>
                <input
                  className="input-field"
                  value={form.condominioNome}
                  onChange={(e) => update("condominioNome", e.target.value)}
                  placeholder="Ex: Residencial Vila Mariana"
                />
                {errors.condominioNome && (
                  <p className="mt-1 text-xs text-coral-700">{errors.condominioNome}</p>
                )}
              </div>
              <div>
                <label className="label-field">CNPJ</label>
                <input
                  className="input-field"
                  value={form.cnpj}
                  onChange={(e) => update("cnpj", e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <label className="label-field">Endereço</label>
                <input
                  className="input-field"
                  value={form.endereco}
                  onChange={(e) => update("endereco", e.target.value)}
                  placeholder="Rua, número, bairro"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
              Escolha o plano
            </h3>
            <div className="space-y-2">
              {PLANS.map((plan) => (
                <label
                  key={plan.id}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition ${
                    planId === plan.id
                      ? "border-coral bg-coral-50"
                      : "border-navy-100 hover:border-navy-300"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="plan"
                      checked={planId === plan.id}
                      onChange={() => setPlanId(plan.id)}
                      className="h-4 w-4 accent-coral"
                    />
                    <span>
                      <span className="font-semibold text-navy-900">{plan.name}</span>{" "}
                      <span className="text-sm text-navy-500">até {plan.unitLimit} un</span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold text-navy-900">R$ {plan.price}/mês</span>
                    {taxasAdesao[plan.id] != null && (
                      <span className="block text-xs text-navy-400">
                        + R$ {taxasAdesao[plan.id]} de adesão
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
              Cupom de desconto (opcional)
            </h3>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                value={cupomInput}
                onChange={(e) => {
                  setCupomInput(e.target.value);
                  setCupomAplicado(null);
                  setErroCupom("");
                }}
                placeholder="Código do cupom"
              />
              <button
                type="button"
                onClick={aplicarCupom}
                disabled={validandoCupom || !cupomInput.trim()}
                className="btn-secondary flex-none"
              >
                {validandoCupom ? "Validando..." : "Aplicar"}
              </button>
            </div>
            {erroCupom && <p className="mt-1 text-xs text-coral-700">{erroCupom}</p>}
            {cupomAplicado && (
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                Cupom &quot;{cupomAplicado.codigo}&quot; aplicado — desconto na taxa de adesão.
              </p>
            )}
          </div>

          {formError && <p className="text-sm text-coral-700">{formError}</p>}

          <div className="flex items-center gap-3 pt-2">
            {onClose && (
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>
            )}
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Carregando..." : "Continuar para pagamento"}
            </button>
          </div>

          {TEST_MODE && (
            <div className="rounded-lg border border-dashed border-navy-200 bg-navy-50/50 p-3 text-center">
              <button
                type="button"
                onClick={handleTestSignup}
                disabled={loading}
                className="text-sm font-semibold text-coral hover:underline disabled:opacity-50"
              >
                Pular pagamento (ambiente de testes)
              </button>
              <p className="mt-1 text-xs text-navy-400">
                Cria a conta direto, sem Stripe. Visível só porque NEXT_PUBLIC_TEST_MODE=true.
              </p>
            </div>
          )}
        </form>
      )}

      {step === STEPS.PAGAMENTO && clientSecret && (
        <div className="space-y-4">
          <div className="rounded-lg bg-navy-50 px-4 py-3 text-sm text-navy-700">
            Plano <strong>{selectedPlan.name}</strong> — R$ {selectedPlan.price}/mês após 14
            dias grátis. Cobraremos a taxa de adesão de{" "}
            <strong>R$ {calcularAdesaoComCupom(taxasAdesao[planId], cupomAplicado)}</strong>{" "}
            agora.
          </div>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <StripePaymentForm
              onSuccess={handlePaymentSuccess}
              onBack={() => setStep(STEPS.DADOS)}
              submitting={submitting}
              setSubmitting={setSubmitting}
            />
          </Elements>
          {formError && <p className="text-sm text-coral-700">{formError}</p>}
        </div>
      )}

      {step === STEPS.SUCESSO && (
        <div className="py-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-coral-50 text-3xl">
            ✅
          </div>
          <h3 className="mt-4 font-display text-xl font-bold text-navy-900">
            Conta criada com sucesso!
          </h3>
          <p className="mt-2 text-navy-600">
            Login automático em {countdown}s... Redirecionando para o dashboard.
          </p>
        </div>
      )}
    </div>
  );
}

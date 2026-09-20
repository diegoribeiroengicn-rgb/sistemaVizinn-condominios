"use client";

import { useAuth } from "@/hooks/useAuth";

const BLOCKED_STATUSES = new Set(["suspended", "canceled", "unpaid", "incomplete_expired"]);

const MESSAGES = {
  suspended: {
    title: "Acesso suspenso",
    text: "O acesso deste condomínio foi suspenso pela administração da Vizinn. Entre em contato com o suporte para regularizar.",
  },
  canceled: {
    title: "Assinatura cancelada",
    text: "A assinatura deste condomínio foi cancelada. Fale com o suporte para reativar o acesso.",
  },
  unpaid: {
    title: "Pagamento pendente",
    text: "Não conseguimos confirmar o pagamento da sua assinatura. Atualize seus dados de cobrança para continuar usando a Vizinn.",
  },
  incomplete_expired: {
    title: "Cadastro incompleto",
    text: "O pagamento inicial não foi confirmado a tempo. Entre em contato com o suporte para reativar sua conta.",
  },
};

// Blocks the dashboard (but not logout) when the platform admin has
// suspended/canceled this condominio, or Stripe reports an unpaid/expired
// subscription. "promessa" and "cortesia" are intentionally NOT blocked —
// those are admin-granted access, not a problem state.
export default function AccessGate({ children }) {
  const { condominio, logout } = useAuth();

  if (!condominio || !BLOCKED_STATUSES.has(condominio.status)) {
    return children;
  }

  const { title, text } = MESSAGES[condominio.status] || MESSAGES.suspended;

  return (
    <div className="card mx-auto max-w-lg text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-coral-50 text-2xl">
        ⚠️
      </div>
      <h1 className="mt-4 font-display text-xl font-bold text-navy-900">{title}</h1>
      <p className="mt-2 text-navy-600">{text}</p>
      {condominio.access_note && (
        <p className="mt-3 rounded-lg bg-navy-50 px-4 py-2 text-sm text-navy-500">
          {condominio.access_note}
        </p>
      )}
      <button onClick={logout} className="btn-secondary mt-6">
        Sair
      </button>
    </div>
  );
}

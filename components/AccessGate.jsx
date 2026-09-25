"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { vendedorFetch } from "@/lib/vendedorFetch";
import { useAdminAcesso } from "@/hooks/useAdminAcesso";

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
  const { user, condominio, role, loading, logout, accessError, refreshCondominio } = useAuth();
  const { carregando: checandoFuncionario, autorizado: isFuncionarioAdmin } = useAdminAcesso();
  const router = useRouter();
  const [checandoVendedor, setChecandoVendedor] = useState(true);
  const [tentandoDeNovo, setTentandoDeNovo] = useState(false);

  // Um usuário sem condominio/membro pode não ser um cadastro quebrado
  // — pode ser um vendedor, que tem painel próprio em
  // /vendedor/dashboard (ver seção "acesso de vendedor"). Confere no
  // banco (não só metadata do token, que pode estar desatualizado)
  // antes de mostrar a tela de "não encontramos seu condomínio".
  useEffect(() => {
    if (loading || !user || role) {
      setChecandoVendedor(false);
      return;
    }
    let ativo = true;
    vendedorFetch("/api/vendedor/me")
      .then((res) => {
        if (!ativo) return;
        if (res.ok) {
          router.replace("/vendedor/dashboard");
        } else {
          setChecandoVendedor(false);
        }
      })
      .catch(() => {
        if (ativo) setChecandoVendedor(false);
      });
    return () => {
      ativo = false;
    };
  }, [loading, user, role, router]);

  // Mesma lógica pra funcionário do painel admin (equipe do Vizinn,
  // não vendedor) — também não tem condominio/membro.
  useEffect(() => {
    if (!loading && user && !role && !checandoFuncionario && isFuncionarioAdmin) {
      router.replace("/admin");
    }
  }, [loading, user, role, checandoFuncionario, isFuncionarioAdmin, router]);

  async function tentarDeNovo() {
    setTentandoDeNovo(true);
    try {
      await refreshCondominio();
    } finally {
      setTentandoDeNovo(false);
    }
  }

  // Auth resolved (not loading) but neither a condominio nor a membro row
  // was found for this user. Duas situações bem diferentes:
  // - accessError: a consulta em si falhou (rede/timeout/erro transitório)
  //   — não dá pra saber se a conta tem acesso ou não, então mostra um
  //   "tentar de novo" em vez do alarmante "não encontramos seu condomínio".
  // - de verdade não achou nada: aí sim é provavelmente um cadastro
  //   quebrado (ou vendedor/funcionário, checado abaixo).
  if (!loading && user && !role) {
    if (accessError) {
      return (
        <div className="card mx-auto max-w-lg text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-2xl">
            ⚠️
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-navy-900">
            Não conseguimos carregar seus dados
          </h1>
          <p className="mt-2 text-navy-600">
            Tivemos um problema temporário ao buscar sua conta. Isso geralmente é passageiro —
            tente de novo em alguns segundos.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={tentarDeNovo} disabled={tentandoDeNovo} className="btn-primary">
              {tentandoDeNovo ? "Tentando..." : "Tentar de novo"}
            </button>
            <button onClick={logout} className="btn-secondary">
              Sair
            </button>
          </div>
        </div>
      );
    }
    if (checandoVendedor || checandoFuncionario || isFuncionarioAdmin) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-navy-500">Carregando...</p>
        </div>
      );
    }
    return (
      <div className="card mx-auto max-w-lg text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-coral-50 text-2xl">
          ⚠️
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-navy-900">
          Não encontramos seu condomínio
        </h1>
        <p className="mt-2 text-navy-600">
          Sua conta existe, mas não está vinculada a nenhum condomínio ou acesso — geralmente
          isso acontece quando o cadastro terminou com erro. Saia e cadastre-se novamente, ou
          entre em contato com o suporte.
        </p>
        <button onClick={logout} className="btn-secondary mt-6">
          Sair
        </button>
      </div>
    );
  }

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

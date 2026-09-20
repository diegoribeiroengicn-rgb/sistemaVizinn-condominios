"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getPlan } from "@/lib/plans";

const nextSteps = [
  {
    title: "Importar condôminos",
    description: "Cadastre as unidades manualmente ou importe uma planilha CSV.",
    href: "/dashboard/configuracoes",
    cta: "Importar condôminos",
  },
  {
    title: "Gerar primeiro boleto",
    description: "Crie e envie o primeiro boleto para as unidades cadastradas.",
    href: "/dashboard/boletos",
    cta: "Gerar boleto",
  },
  {
    title: "Convidar síndico",
    description: "Adicione outro administrador para ajudar na gestão do condomínio.",
    href: "/dashboard/configuracoes",
    cta: "Convidar",
  },
  {
    title: "Ver tutorial",
    description: "Um vídeo de 3 minutos mostrando o básico da plataforma.",
    href: "#",
    cta: "Assistir",
  },
];

const quickActions = [
  { label: "Novo Boleto", href: "/dashboard/boletos" },
  { label: "Novo Chamado", href: "/dashboard/chamados" },
  { label: "Avisos", href: "/dashboard/avisos" },
];

export default function DashboardContent() {
  const { condominio } = useAuth();

  // Mocked fallback so the dashboard is always usable, even before
  // Supabase is configured or while the condominio row is still loading.
  const data = condominio || {
    nome: "Seu condomínio",
    plano: "growth",
    unidades_limite: 100,
  };

  const plan = getPlan(data.plano);
  const unidadesAtivas = data.unidades_ativas ?? 0;

  const stats = [
    { label: "Boletos pendentes", value: "-" },
    { label: "Inadimplência", value: "0%" },
    { label: "Arrecadação", value: "R$ 0" },
    { label: "Chamados", value: "0" },
  ];

  return (
    <div className="space-y-8">
      <section className="card">
        <p className="text-sm font-medium text-navy-400">Seu condomínio</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy-900">{data.nome}</h1>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-navy-600">
          <span>
            Plano: <strong className="text-navy-900">{plan.name}</strong> (R$ {plan.price}
            /mês)
          </span>
          <span>
            Unidades: <strong className="text-navy-900">{unidadesAtivas}</strong>/
            {data.unidades_limite}
          </span>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Resumo
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card">
              <p className="text-xs text-navy-400">{s.label}</p>
              <p className="mt-1 font-display text-xl font-bold text-navy-900">{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Próximos passos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {nextSteps.map((step, i) => (
            <div key={step.title} className="card flex items-start gap-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div className="flex-1">
                <h3 className="font-semibold text-navy-900">{step.title}</h3>
                <p className="mt-1 text-sm text-navy-500">{step.description}</p>
                <Link
                  href={step.href}
                  className="mt-3 inline-block text-sm font-semibold text-coral hover:underline"
                >
                  {step.cta} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Ações rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href} className="btn-primary">
              {action.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

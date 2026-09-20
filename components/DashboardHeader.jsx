"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const NAV_BY_ROLE = {
  sindico: [
    { href: "/dashboard", label: "Visão geral" },
    { href: "/dashboard/boletos", label: "Boletos" },
    { href: "/dashboard/chamados", label: "Chamados" },
    { href: "/dashboard/avisos", label: "Avisos" },
    { href: "/dashboard/ocorrencias", label: "Ocorrências" },
    { href: "/dashboard/propostas", label: "Propostas" },
    { href: "/dashboard/acessos", label: "Acessos" },
    { href: "/dashboard/configuracoes", label: "Configurações" },
  ],
  condomino: [{ href: "/dashboard/avisos", label: "Avisos" }],
  porteiro: [{ href: "/dashboard/ocorrencias", label: "Ocorrências" }],
  conselheiro: [{ href: "/dashboard/propostas", label: "Propostas" }],
};

const ROLE_LABELS = {
  sindico: "Síndico",
  condomino: "Condômino",
  porteiro: "Porteiro",
  conselheiro: "Conselheiro",
};

export default function DashboardHeader() {
  const { user, condominio, role, isAdmin, logout } = useAuth();
  const pathname = usePathname();
  const navItems = NAV_BY_ROLE[role] || [];

  const displayName =
    user?.user_metadata?.full_name || condominio?.responsavel_nome || user?.email || "Síndico";

  return (
    <header className="border-b border-navy-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 1920 1920" fill="none" aria-hidden="true">
            <path
              d="M804 402c40-40 108-12 108 44v378c0 30 12 59 34 80l7 6 7-6c22-21 34-50 34-80V446c0-56 68-84 108-44l236 236c78 78 122 184 122 294v378c0 92-75 167-167 167h-134V1231a153 153 0 0 0-306 0v270H610c-92 0-167-75-167-167V976c0-110 44-216 122-294l239-236z"
              fill="#0a1f3f"
            />
            <circle cx="960" cy="807" r="112" fill="#e45d4e" />
          </svg>
          <span className="font-display text-lg font-bold text-navy-900">Vizinn</span>
        </Link>

        <span className="hidden text-sm text-navy-500 sm:inline">
          Bem-vindo, <strong className="text-navy-800">{displayName}</strong>
          {role && role !== "sindico" && (
            <span className="ml-2 rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
              {ROLE_LABELS[role]}
            </span>
          )}
        </span>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href="/admin" className="btn-ghost hidden sm:inline-flex">
              Painel admin
            </Link>
          )}
          <button onClick={logout} className="btn-secondary">
            Sair
          </button>
        </div>
      </div>

      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
                active ? "bg-navy-900 text-white" : "text-navy-600 hover:bg-navy-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

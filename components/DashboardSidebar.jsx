"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { MODULO_LABELS, MODULO_ROUTES, PAPEL_LABELS } from "@/lib/permissoes";
import { getStoredTheme, setStoredTheme } from "@/lib/theme";
import {
  IconVisaoGeral,
  IconFinanceiro,
  IconChamados,
  IconAvisos,
  IconOcorrencias,
  IconManutencao,
  IconPropostas,
  IconFornecedores,
  IconAcessos,
  IconPortaria,
  IconAuditoria,
  IconConfiguracoes,
  IconSol,
  IconLua,
  IconMenu,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconSair,
} from "@/components/icons";

// Menu fixo do síndico (todos os módulos, inclui Configurações que não é
// concedível). Outros papéis veem só os módulos onde têm permissão de
// "visualizar" — ver hooks/useAuth.js (modulosVisiveis).
const SINDICO_NAV = [
  { href: "/dashboard", label: "Visão geral", Icon: IconVisaoGeral },
  { href: "/dashboard/financeiro", label: "Financeiro", Icon: IconFinanceiro },
  { href: "/dashboard/chamados", label: "Chamados", Icon: IconChamados },
  { href: "/dashboard/avisos", label: "Avisos", Icon: IconAvisos },
  { href: "/dashboard/ocorrencias", label: "Ocorrências", Icon: IconOcorrencias },
  { href: "/dashboard/manutencao", label: "Manutenção", Icon: IconManutencao },
  { href: "/dashboard/propostas", label: "Propostas", Icon: IconPropostas },
  { href: "/dashboard/fornecedores", label: "Fornecedores", Icon: IconFornecedores },
  { href: "/dashboard/acessos", label: "Acessos", Icon: IconAcessos },
  { href: "/dashboard/portaria", label: "Portaria", Icon: IconPortaria },
  { href: "/dashboard/auditoria", label: "Auditoria", Icon: IconAuditoria },
  { href: "/dashboard/configuracoes", label: "Configurações", Icon: IconConfiguracoes },
];

const ICON_BY_MODULO = {
  visao_geral: IconVisaoGeral,
  financeiro: IconFinanceiro,
  chamados: IconChamados,
  avisos: IconAvisos,
  ocorrencias: IconOcorrencias,
  manutencao: IconManutencao,
  propostas: IconPropostas,
  fornecedores: IconFornecedores,
  acessos: IconAcessos,
  portaria: IconPortaria,
  auditoria: IconAuditoria,
};

const ROLE_LABELS = { sindico: "Síndico", ...PAPEL_LABELS };

const SIDEBAR_COLLAPSE_KEY = "vizinn-sidebar-collapsed";

export default function DashboardSidebar() {
  const { user, condominio, role, modulosVisiveis, isAdmin, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tema, setTema] = useState("light");

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
    } catch {
      // ignora — só começa expandido
    }
    setTema(getStoredTheme() || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const novo = !c;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, novo ? "1" : "0");
      } catch {
        // sem persistência, sem problema
      }
      return novo;
    });
  }

  function alternarTema() {
    const novo = tema === "dark" ? "light" : "dark";
    setTema(novo);
    setStoredTheme(novo);
  }

  const navItems =
    role === "sindico"
      ? SINDICO_NAV
      : modulosVisiveis.map((m) => ({
          href: MODULO_ROUTES[m],
          label: MODULO_LABELS[m],
          Icon: ICON_BY_MODULO[m] || IconVisaoGeral,
        }));

  const displayName =
    user?.user_metadata?.full_name || condominio?.responsavel_nome || user?.email || "Síndico";

  const conteudo = (
    <>
      <div className="flex items-center gap-2.5 px-4 py-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <svg width="40" height="40" viewBox="0 0 1920 1920" fill="none" aria-hidden="true" className="flex-none">
            <path
              d="M804 402c40-40 108-12 108 44v378c0 30 12 59 34 80l7 6 7-6c22-21 34-50 34-80V446c0-56 68-84 108-44l236 236c78 78 122 184 122 294v378c0 92-75 167-167 167h-134V1231a153 153 0 0 0-306 0v270H610c-92 0-167-75-167-167V976c0-110 44-216 122-294l239-236z"
              fill="#e45d4e"
            />
            <circle cx="960" cy="807" r="112" fill="#e45d4e" />
          </svg>
          {!collapsed && <span className="font-display text-2xl font-bold tracking-tight text-white">Vizinn</span>}
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-coral text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.Icon className="h-5 w-5 flex-none" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            title={collapsed ? "Painel admin" : undefined}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <IconConfiguracoes className="h-5 w-5 flex-none" />
            {!collapsed && <span className="truncate">Painel admin</span>}
          </Link>
        )}
      </nav>

      <div className="space-y-2 border-t border-white/10 px-2 py-3">
        {!collapsed && (
          <div className="px-2 text-xs text-white/50">
            <p className="truncate font-medium text-white">{displayName}</p>
            {role && (
              <span className="mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">
                {ROLE_LABELS[role] || role}
              </span>
            )}
          </div>
        )}

        <button
          onClick={alternarTema}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          {tema === "dark" ? <IconSol className="h-5 w-5 flex-none" /> : <IconLua className="h-5 w-5 flex-none" />}
          {!collapsed && <span>{tema === "dark" ? "Tema claro" : "Tema escuro"}</span>}
        </button>

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <IconSair className="h-5 w-5 flex-none" />
          {!collapsed && <span>Sair</span>}
        </button>

        <button
          onClick={toggleCollapsed}
          className="hidden w-full items-center justify-center rounded-xl px-3 py-2 text-white/50 transition hover:bg-white/10 hover:text-white lg:flex"
        >
          {collapsed ? <IconChevronRight className="h-4 w-4" /> : <IconChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Barra fina no celular/tablet — abre o menu lateral como gaveta */}
      <div className="flex items-center justify-between border-b border-white/10 bg-sidebar px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 1920 1920" fill="none" aria-hidden="true">
            <path
              d="M804 402c40-40 108-12 108 44v378c0 30 12 59 34 80l7 6 7-6c22-21 34-50 34-80V446c0-56 68-84 108-44l236 236c78 78 122 184 122 294v378c0 92-75 167-167 167h-134V1231a153 153 0 0 0-306 0v270H610c-92 0-167-75-167-167V976c0-110 44-216 122-294l239-236z"
              fill="#e45d4e"
            />
            <circle cx="960" cy="807" r="112" fill="#e45d4e" />
          </svg>
          <span className="font-display text-xl font-bold tracking-tight text-white">Vizinn</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-2 text-white hover:bg-white/10"
        >
          <IconMenu className="h-6 w-6" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-midnight/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-4 rounded-lg p-1.5 text-white hover:bg-white/10"
            >
              <IconX className="h-5 w-5" />
            </button>
            {conteudo}
          </aside>
        </div>
      )}

      <aside
        className={`sticky top-0 hidden h-screen flex-none flex-col bg-sidebar transition-all lg:flex ${
          collapsed ? "w-[72px]" : "w-60"
        }`}
      >
        {conteudo}
      </aside>
    </>
  );
}

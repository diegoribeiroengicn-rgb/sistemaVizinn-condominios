"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  IconVisaoGeral,
  IconMoradores,
  IconFornecedores,
  IconAcademia,
  IconFinanceiro,
  IconRelatorios,
  IconAvisos,
  IconColaboradores,
  IconConfiguracoes,
  IconSair,
  IconMenu,
  IconX,
  IconChevronLeft,
  IconChevronRight,
} from "@/components/icons";

// Painel admin (dono da plataforma) — menu lateral esquerda, igual ao
// dashboard de condomínio, em vez da barra horizontal de cima que
// existia antes.
const ADMIN_NAV = [
  { href: "/admin", label: "Visão geral", Icon: IconVisaoGeral },
  { href: "/admin/condominios", label: "Condomínios", Icon: IconMoradores },
  { href: "/admin/fornecedores", label: "Fornecedores", Icon: IconFornecedores },
  { href: "/admin/academia", label: "Academia", Icon: IconAcademia },
  { href: "/admin/financeiro", label: "Financeiro", Icon: IconFinanceiro },
  { href: "/admin/pagamentos", label: "Vendedores", Icon: IconColaboradores },
  { href: "/admin/comissoes", label: "Comissões", Icon: IconRelatorios },
  { href: "/admin/configuracoes/comissionamento", label: "Comissionamento", Icon: IconConfiguracoes },
  { href: "/admin/chatbot", label: "Chatbot", Icon: IconAvisos },
];

const SIDEBAR_COLLAPSE_KEY = "vizinn-admin-sidebar-collapsed";

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
    } catch {
      // ignora — só começa expandido
    }
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

  const conteudo = (
    <>
      <div className="flex items-center gap-2.5 px-4 py-6">
        <Link href="/admin" className="flex items-center gap-2.5">
          <svg width="40" height="40" viewBox="0 0 1920 1920" fill="none" aria-hidden="true" className="flex-none">
            <path
              d="M804 402c40-40 108-12 108 44v378c0 30 12 59 34 80l7 6 7-6c22-21 34-50 34-80V446c0-56 68-84 108-44l236 236c78 78 122 184 122 294v378c0 92-75 167-167 167h-134V1231a153 153 0 0 0-306 0v270H610c-92 0-167-75-167-167V976c0-110 44-216 122-294l239-236z"
              fill="#e45d4e"
            />
            <circle cx="960" cy="807" r="112" fill="#e45d4e" />
          </svg>
          {!collapsed && (
            <span className="flex items-center gap-2">
              <span className="font-display text-2xl font-bold tracking-tight text-white">Vizinn</span>
              <span className="rounded-full bg-coral px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
            </span>
          )}
        </Link>
      </div>

      <nav className="sidebar-scroll flex-1 space-y-0.5 overflow-y-auto px-2">
        {ADMIN_NAV.map((item) => {
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
        <Link
          href="/dashboard"
          title={collapsed ? "Meu condomínio" : undefined}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <IconVisaoGeral className="h-5 w-5 flex-none" />
          {!collapsed && <span className="truncate">Meu condomínio</span>}
        </Link>
      </nav>

      <div className="space-y-2 border-t border-white/10 px-2 py-3">
        {!collapsed && (
          <div className="px-2 text-xs text-white/50">
            <p className="truncate font-medium text-white">{user?.email}</p>
          </div>
        )}

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
      <div className="flex items-center justify-between border-b border-white/10 bg-sidebar px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 1920 1920" fill="none" aria-hidden="true">
            <path
              d="M804 402c40-40 108-12 108 44v378c0 30 12 59 34 80l7 6 7-6c22-21 34-50 34-80V446c0-56 68-84 108-44l236 236c78 78 122 184 122 294v378c0 92-75 167-167 167h-134V1231a153 153 0 0 0-306 0v270H610c-92 0-167-75-167-167V976c0-110 44-216 122-294l239-236z"
              fill="#e45d4e"
            />
            <circle cx="960" cy="807" r="112" fill="#e45d4e" />
          </svg>
          <span className="font-display text-xl font-bold tracking-tight text-white">Vizinn Admin</span>
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

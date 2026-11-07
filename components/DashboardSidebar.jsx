"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { MODULO_LABELS, MODULO_ROUTES, PAPEL_LABELS } from "@/lib/permissoes";
import { getStoredTheme, setStoredTheme } from "@/lib/theme";
import { useFormDirty } from "@/lib/formDirtyContext";
import {
  IconVisaoGeral,
  IconFinanceiro,
  IconChamados,
  IconAvisos,
  IconOcorrencias,
  IconManutencao,
  IconFornecedores,
  IconAcessos,
  IconPortaria,
  IconAuditoria,
  IconColaboradores,
  IconMoradores,
  IconVeiculos,
  IconObras,
  IconAssembleia,
  IconAreasComuns,
  IconEnquetes,
  IconDocumentos,
  IconAcademia,
  IconRelatorios,
  IconLembretes,
  IconConfiguracoes,
  IconSol,
  IconLua,
  IconMenu,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconSair,
  IconMulticondominios,
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
  { href: "/dashboard/fornecedores", label: "Fornecedores", Icon: IconFornecedores },
  { href: "/dashboard/acessos", label: "Acessos", Icon: IconAcessos },
  { href: "/dashboard/portaria", label: "Portaria", Icon: IconPortaria },
  { href: "/dashboard/auditoria", label: "Auditoria", Icon: IconAuditoria },
  { href: "/dashboard/colaboradores", label: "Colaboradores", Icon: IconColaboradores },
  { href: "/dashboard/moradores", label: "Moradores", Icon: IconMoradores },
  { href: "/dashboard/veiculos", label: "Veículos", Icon: IconVeiculos },
  { href: "/dashboard/obras", label: "Obras e Melhorias", Icon: IconObras },
  { href: "/dashboard/lembretes", label: "Lembretes", Icon: IconLembretes },
  { href: "/dashboard/assembleias", label: "Assembleias", Icon: IconAssembleia },
  { href: "/dashboard/areas-comuns", label: "Áreas Comuns", Icon: IconAreasComuns },
  { href: "/dashboard/enquetes", label: "Enquetes", Icon: IconEnquetes },
  { href: "/dashboard/documentos", label: "Documentos", Icon: IconDocumentos },
  { href: "/dashboard/academia", label: "Academia AquiHabitto", Icon: IconAcademia },
  { href: "/dashboard/relatorios", label: "Relatórios", Icon: IconRelatorios },
  { href: "/dashboard/configuracoes", label: "Configurações", Icon: IconConfiguracoes },
];

// Relatórios não é um módulo concedível próprio — reaproveita a
// permissão de "visualizar" de qualquer um dos módulos que ele cobre
// (financeiro/chamados/avisos/portaria/auditoria), igual à própria
// página faz pra decidir quais relatórios oferecer.
const MODULOS_COM_RELATORIO = ["financeiro", "chamados", "avisos", "portaria", "auditoria"];

const ICON_BY_MODULO = {
  visao_geral: IconVisaoGeral,
  financeiro: IconFinanceiro,
  chamados: IconChamados,
  avisos: IconAvisos,
  ocorrencias: IconOcorrencias,
  manutencao: IconManutencao,
  fornecedores: IconFornecedores,
  acessos: IconAcessos,
  portaria: IconPortaria,
  auditoria: IconAuditoria,
  colaboradores: IconColaboradores,
  moradores: IconMoradores,
  veiculos: IconVeiculos,
  obras: IconObras,
  lembretes: IconLembretes,
  assembleias: IconAssembleia,
  areas_comuns: IconAreasComuns,
  enquetes: IconEnquetes,
  documentos: IconDocumentos,
};

const ROLE_LABELS = { sindico: "Síndico", ...PAPEL_LABELS };

const SIDEBAR_COLLAPSE_KEY = "aquihabitto-sidebar-collapsed";

export default function DashboardSidebar() {
  const { user, condominio, condominiosDoDono, trocarCondominio, role, modulosVisiveis, isAdmin, logout, temPermissao } = useAuth();
  const pathname = usePathname();
  const { dirty } = useFormDirty();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tema, setTema] = useState("light");

  // Chamado antes de qualquer navegação/saída que possa perder dados —
  // devolve false (e cancela o clique) se a pessoa desistir de sair.
  function confirmarSaida(e) {
    if (dirty && !window.confirm("Você tem alterações não salvas nesta página. Sair mesmo assim?")) {
      e.preventDefault();
      return false;
    }
    return true;
  }

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
      ? [
          ...SINDICO_NAV,
          // Só aparece pra quem tem o Pro+ Multicondomínios ativo e mais
          // de 1 condomínio vinculado à conta — ver contas_sindico no
          // schema e o seletor logo acima no topo da barra lateral.
          ...(temProPlusMulticondominios && condominiosDoDono.length > 1
            ? [{ href: "/dashboard/multicondominios", label: "Multicondomínios", Icon: IconMulticondominios }]
            : []),
        ]
      : [
          // "propostas" é uma permissão concedível mas não tem página
          // própria (ver nota em lib/permissoes.js) — filtra qualquer
          // módulo sem rota em vez de gerar um link quebrado.
          ...modulosVisiveis
            .filter((m) => MODULO_ROUTES[m])
            .map((m) => ({
              href: MODULO_ROUTES[m],
              label: MODULO_LABELS[m],
              Icon: ICON_BY_MODULO[m] || IconVisaoGeral,
            })),
          // Academia não é um módulo por condomínio (é conteúdo da
          // plataforma, liberado por nível de acesso conforme a
          // assinatura) — por isso aparece pra qualquer pessoa logada,
          // sem depender de permissão concedida em Acessos.
          { href: "/dashboard/academia", label: "Academia AquiHabitto", Icon: IconAcademia },
          // "Meu Financeiro" é a própria unidade do condômino vendo o que
          // já existe em contas_receber (2ª via de boleto, extrato) — não
          // é o módulo "financeiro" (que dá acesso ao financeiro inteiro
          // do condomínio), por isso não é concedível em Acessos: aparece
          // direto pra quem tem papel "condomino".
          ...(role === "condomino"
            ? [{ href: "/dashboard/meu-financeiro", label: "Meu Financeiro", Icon: IconFinanceiro }]
            : []),
          ...(MODULOS_COM_RELATORIO.some((m) => temPermissao(m, "visualizar"))
            ? [{ href: "/dashboard/relatorios", label: "Relatórios", Icon: IconRelatorios }]
            : []),
        ];

  const displayName =
    user?.user_metadata?.full_name || condominio?.responsavel_nome || user?.email || "Síndico";

  const conteudo = (
    <>
      <div className="flex items-center gap-2.5 px-4 py-6">
        <Link href="/dashboard" onClick={confirmarSaida} className="flex items-center gap-2.5">
          <span className="flex-none rounded-lg bg-cream-50 p-1">
            <Image src="/brand/aquihabitto-mark.png" alt="AquiHabitto" width={32} height={32} />
          </span>
          {!collapsed && (
            <span className="flex flex-col">
              <span className="font-display text-2xl font-bold leading-none tracking-tight text-white">
                Aqui
                <br />
                Habitto<span className="ml-1 inline-block h-1.5 w-1.5 translate-y-1 align-middle bg-coral" />
              </span>
              <span className="mt-1.5 h-0.5 w-10 bg-coral" />
            </span>
          )}
        </Link>
      </div>

      {/* Seletor de condomínio ativo — só aparece pra quem tem mais de 1
          (Pro+ Multicondomínios). Com 1 só, renderiza nada, igual sempre
          foi. Trocar aqui não pede login de novo: é só o mesmo dono
          apontando pra outra linha de `condominios`, RLS já isola cada
          uma. */}
      {condominiosDoDono.length > 1 && (
        <div className="px-2 pb-2">
          {!collapsed ? (
            <select
              value={condominio?.id || ""}
              onChange={(e) => trocarCondominio(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white"
            >
              {condominiosDoDono.map((c) => (
                <option key={c.id} value={c.id} className="text-navy-900">
                  {c.nome}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={condominio?.id || ""}
              onChange={(e) => trocarCondominio(e.target.value)}
              title="Trocar condomínio"
              className="w-full rounded-xl border border-white/10 bg-white/10 px-1 py-2 text-xs text-white"
            >
              {condominiosDoDono.map((c) => (
                <option key={c.id} value={c.id} className="text-navy-900">
                  {c.nome}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <nav className="sidebar-scroll flex-1 space-y-0.5 overflow-y-auto px-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={confirmarSaida}
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
            onClick={confirmarSaida}
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
          onClick={() => {
            if (dirty && !window.confirm("Você tem alterações não salvas nesta página. Sair mesmo assim?")) return;
            logout();
          }}
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
        <Link href="/dashboard" onClick={confirmarSaida} className="flex items-center gap-2">
          <span className="flex-none rounded-lg bg-cream-50 p-1">
            <Image src="/brand/aquihabitto-mark.png" alt="AquiHabitto" width={24} height={24} />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-white">AquiHabitto</span>
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

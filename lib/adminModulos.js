// Seções do painel admin que podem ser liberadas por funcionário (ver
// admin_funcionarios) — os mesmos módulos que aparecem na sidebar
// (components/AdminSidebar.jsx). Fonte única: tanto a checagem no
// servidor (requireAdmin(request, modulo) em lib/adminAuth.js) quanto
// a UI de gestão de funcionários e a sidebar (que esconde o que o
// funcionário não pode ver) usam essa lista.
export const ADMIN_MODULOS = [
  { id: "geral", label: "Visão geral" },
  { id: "condominios", label: "Condomínios" },
  { id: "fornecedores", label: "Fornecedores" },
  { id: "academia", label: "Academia" },
  { id: "financeiro", label: "Financeiro" },
  { id: "vendedores", label: "Vendedores" },
  { id: "comissoes", label: "Comissões" },
  { id: "comissionamento", label: "Comissionamento" },
  { id: "chatbot", label: "Chatbot" },
];

export const ADMIN_MODULO_IDS = ADMIN_MODULOS.map((m) => m.id);

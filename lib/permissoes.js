// Modelo de permissões: cada acesso (membros) tem uma coluna `permissoes`
// (jsonb) no formato { [modulo]: ["visualizar", "criar", ...] } — o
// síndico marca, módulo por módulo, quais ações aquela pessoa pode fazer.
// O papel só preenche um ponto de partida sugerido (DEFAULT_PERMISSOES_
// BY_PAPEL); dali em diante quem manda é essa coluna. Mudar uma chave
// aqui exige atualizar supabase/schema.sql junto (funções
// membro_tem_modulo / membro_tem_permissao e as políticas de RLS).

export const ACOES = ["visualizar", "criar", "editar", "excluir", "aprovar"];

export const ACAO_LABELS = {
  visualizar: "Visualizar",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
  aprovar: "Aprovar",
};

// "acessos" e "auditoria" também são módulos concedíveis (o síndico pode
// deixar um subsíndico/administrador ver ou até gerenciar acessos, por
// exemplo) — só "configuracoes" fica sempre exclusivo do síndico.
// "boletos" virou uma aba dentro de "financeiro" (ver README) — não é
// mais um módulo próprio.
export const MODULO_LABELS = {
  visao_geral: "Visão geral",
  financeiro: "Financeiro",
  chamados: "Chamados",
  avisos: "Avisos",
  ocorrencias: "Ocorrências",
  manutencao: "Manutenção",
  propostas: "Propostas",
  fornecedores: "Fornecedores",
  acessos: "Acessos",
  portaria: "Portaria",
  auditoria: "Auditoria",
  colaboradores: "Colaboradores",
  moradores: "Moradores",
  obras: "Obras e Melhorias",
};

export const ALL_MODULOS = Object.keys(MODULO_LABELS);

// Só essas ações fazem sentido pra cada módulo — controla o que aparece
// no editor de permissões. Módulos "informativos" (visão geral) só têm
// visualizar por enquanto.
export const ACOES_POR_MODULO = {
  visao_geral: ["visualizar"],
  financeiro: ["visualizar", "criar", "editar", "excluir"],
  chamados: ["visualizar", "criar", "editar"],
  avisos: ["visualizar", "criar", "excluir"],
  ocorrencias: ["visualizar", "criar"],
  manutencao: ["visualizar", "criar", "editar"],
  propostas: ["visualizar", "criar", "aprovar"],
  fornecedores: ["visualizar", "criar", "editar", "excluir"],
  acessos: ["visualizar", "criar", "editar", "excluir"],
  portaria: ["visualizar", "criar", "editar"],
  auditoria: ["visualizar"],
  colaboradores: ["visualizar", "criar", "editar", "excluir"],
  moradores: ["visualizar", "criar", "editar", "excluir"],
  obras: ["visualizar", "criar", "editar", "excluir"],
};

export const MODULO_ROUTES = {
  visao_geral: "/dashboard",
  financeiro: "/dashboard/financeiro",
  chamados: "/dashboard/chamados",
  avisos: "/dashboard/avisos",
  ocorrencias: "/dashboard/ocorrencias",
  manutencao: "/dashboard/manutencao",
  propostas: "/dashboard/propostas",
  fornecedores: "/dashboard/fornecedores",
  acessos: "/dashboard/acessos",
  portaria: "/dashboard/portaria",
  auditoria: "/dashboard/auditoria",
  colaboradores: "/dashboard/colaboradores",
  moradores: "/dashboard/moradores",
  obras: "/dashboard/obras",
};

export const PAPEL_LABELS = {
  condomino: "Condômino",
  porteiro: "Porteiro",
  conselheiro: "Conselheiro",
  zelador: "Zelador",
  subsindico: "Subsíndico",
  administrador: "Administrador",
};

// Conjunto sugerido quando o síndico escolhe um papel ao criar um acesso —
// só o ponto de partida; a partir daí ele pode marcar/desmarcar ações
// avulsas por módulo, por pessoa, na tela de Acessos.
export const DEFAULT_PERMISSOES_BY_PAPEL = {
  condomino: {
    avisos: ["visualizar"],
  },
  porteiro: {
    avisos: ["visualizar"],
    portaria: ["visualizar", "criar", "editar"],
  },
  conselheiro: {
    avisos: ["visualizar"],
    propostas: ["visualizar", "aprovar"],
  },
  zelador: {
    avisos: ["visualizar"],
    manutencao: ["visualizar", "criar", "editar"],
    ocorrencias: ["visualizar", "criar"],
  },
  // Substitui o síndico no dia a dia — acesso amplo por padrão, mas
  // alterações em Acessos ficam pendentes de aprovação até o síndico
  // liberar (membros.requer_aprovacao, ligado por padrão). Financeiro e
  // Fornecedores ficam de fora do padrão — informação sensível, o
  // síndico concede explicitamente quando quiser.
  subsindico: {
    visao_geral: ["visualizar"],
    chamados: ["visualizar", "criar", "editar"],
    avisos: ["visualizar", "criar", "excluir"],
    ocorrencias: ["visualizar", "criar"],
    manutencao: ["visualizar", "criar", "editar"],
    propostas: ["visualizar", "criar", "aprovar"],
    acessos: ["visualizar", "criar", "editar", "excluir"],
    portaria: ["visualizar"],
    auditoria: ["visualizar"],
    colaboradores: ["visualizar", "criar", "editar"],
    moradores: ["visualizar", "criar", "editar"],
    obras: ["visualizar", "criar", "editar"],
  },
  // Pode representar uma administradora externa — começa mais restrito
  // que o subsíndico; o síndico ajusta conforme o contrato dela.
  administrador: {
    visao_geral: ["visualizar"],
    chamados: ["visualizar", "criar", "editar"],
    avisos: ["visualizar"],
    manutencao: ["visualizar", "criar", "editar"],
    propostas: ["visualizar"],
    acessos: ["visualizar"],
    colaboradores: ["visualizar"],
    moradores: ["visualizar"],
    obras: ["visualizar"],
  },
};

export function papelPodeRequererAprovacao(papel) {
  return papel === "subsindico" || papel === "administrador";
}

// Quem "trabalha no prédio" — usado, por exemplo, pra restringir quem
// pode ser escolhido como responsável de um chamado (nunca um condômino
// ou conselheiro, que não têm essa função operacional).
export const PAPEIS_EQUIPE = ["subsindico", "administrador", "zelador", "porteiro"];

// Nunca confia no jsonb que o cliente manda sem validar: só aceita chaves
// de módulo conhecidas e, dentro delas, só as ações que fazem sentido pra
// aquele módulo (ACOES_POR_MODULO). Usado nas API routes de criar/editar
// acesso antes de gravar em membros.permissoes.
export function sanitizePermissoes(input) {
  if (!input || typeof input !== "object") return {};
  const out = {};
  for (const modulo of ALL_MODULOS) {
    const acoesPermitidas = ACOES_POR_MODULO[modulo] || [];
    const acoesPedidas = Array.isArray(input[modulo]) ? input[modulo] : [];
    const acoes = acoesPedidas.filter((a) => acoesPermitidas.includes(a));
    if (acoes.length > 0) out[modulo] = acoes;
  }
  return out;
}

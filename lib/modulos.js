// Módulos que o síndico pode conceder individualmente a cada acesso
// delimitado, independente do papel. A chave é o mesmo valor gravado em
// membros.modulos (text[]) e checado pela função membro_tem_modulo() no
// banco — mudar uma chave aqui exige atualizar supabase/schema.sql junto.
export const MODULO_LABELS = {
  avisos: "Avisos",
  chamados: "Chamados",
  ocorrencias: "Ocorrências",
  manutencao: "Manutenção",
  propostas: "Propostas",
};

export const ALL_MODULOS = Object.keys(MODULO_LABELS);

export const MODULO_ROUTES = {
  avisos: "/dashboard/avisos",
  chamados: "/dashboard/chamados",
  ocorrencias: "/dashboard/ocorrencias",
  manutencao: "/dashboard/manutencao",
  propostas: "/dashboard/propostas",
};

// Conjunto sugerido quando o síndico escolhe um papel ao criar um acesso —
// só o ponto de partida; a partir daí ele pode marcar/desmarcar módulos
// avulsos por pessoa na tela de Acessos.
export const DEFAULT_MODULOS_BY_PAPEL = {
  condomino: ["avisos"],
  porteiro: ["avisos", "ocorrencias"],
  conselheiro: ["avisos", "propostas"],
  zelador: ["avisos", "manutencao", "ocorrencias"],
};

// Constantes do painel admin relacionadas a Condomínios.

// Deriva um indicador simples ATIVO/INATIVO a partir do `status` que já
// existe em `condominios` — não é uma lógica nova de ativação, só uma
// leitura simplificada do status atual pra exibir na listagem sem
// precisar abrir o cadastro.
const STATUS_ATIVOS = new Set(["active", "trialing", "promessa", "cortesia"]);

export function isCondominioAtivo(status) {
  return STATUS_ATIVOS.has(status);
}

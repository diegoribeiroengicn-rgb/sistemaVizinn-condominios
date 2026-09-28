// Constantes do teto de taxa de adesão por plano e das solicitações de
// aumento — compartilhado entre o painel admin (/admin/pagamentos) e o
// painel do vendedor. O valor em si (taxas_adesao.valor) é o valor
// SUGERIDO; teto é o MÁXIMO que o vendedor pode digitar ao fechar venda
// por fora — ver enforcement em app/api/vendedor/cadastrar-condominio e
// app/api/vendedor/link-pagamento.
export const STATUS_SOLICITACAO_LABELS = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

export const STATUS_SOLICITACAO_STYLES = {
  pendente: "bg-amber-100 text-amber-700",
  aprovado: "bg-emerald-100 text-emerald-700",
  rejeitado: "bg-coral-100 text-coral-700",
};

// teto explícito, ou o valor sugerido enquanto ninguém definiu um teto
// próprio pro plano (mesma regra usada nas rotas de vendedor).
export function tetoEfetivo(taxa) {
  return taxa?.teto != null ? Number(taxa.teto) : Number(taxa?.valor ?? 0);
}

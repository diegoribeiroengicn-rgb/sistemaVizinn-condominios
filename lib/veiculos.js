// Cadastro de Veículos — carros/motos vinculados a uma unidade, cadastrados
// pelo síndico/administração (mesmo padrão do cadastro de Moradores: não
// depende do morador ter login). Ajuda a portaria a conferir se uma placa
// pertence a um morador antes de liberar a entrada.

export const TIPO_VEICULO_LABELS = { carro: "Carro", moto: "Moto", outro: "Outro" };

// Colunas do relatório (download da lista atual em PDF/Word) — ver
// lib/relatorios.js. "tipoLabel" é derivado antes de exportar (ver
// montarConfigRelatorio na página).
export const COLUNAS_RELATORIO = [
  { header: "Unidade", key: "unidade" },
  { header: "Bloco", key: "bloco" },
  { header: "Morador", key: "morador_nome" },
  { header: "Placa", key: "placa" },
  { header: "Modelo", key: "modelo" },
  { header: "Cor", key: "cor" },
  { header: "Tipo", key: "tipoLabel" },
  { header: "Vaga", key: "vaga" },
];

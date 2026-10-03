// Inteligência Financeira — motor de alertas da Visão Geral. Cruza
// sempre dados do PRÓPRIO condomínio (nunca compara valor entre
// condomínios diferentes — ver condominios.fin_* em supabase/schema.sql
// e a contagem agregada/anônima em confianca_fornecedor_global). Nada
// aqui é "descoberta" de vazamento ou de preço justo — só detecta
// desvio em cima do histórico real e devolve texto neutro.

export const CATEGORIAS_CONSUMO = ["Água", "Energia"];

export const DICAS_POR_CATEGORIA = {
  Água: {
    titulo: "Possíveis causas do aumento no consumo de água",
    texto:
      "Um salto no consumo pode vir de vários lugares — vale conferir: vazamento na caixa d'água ou " +
      "tubulação (boia acionando com frequência é um bom sinal), torneiras e descargas de áreas comuns, " +
      "irrigação do jardim (temporizador desregulado), piscina (enchimento frequente pode indicar " +
      "vazamento), inspeção/teste da rede de incêndio, se o condomínio tiver (hidrantes, sprinklers). " +
      "Considere uma vistoria se o aumento persistir.",
    avisoTitulo: "Campanha de economia de água",
    avisoTexto:
      "Moradores, o consumo de água do condomínio aumentou nos últimos meses. Pedimos a colaboração de " +
      "todos: evite banhos longos, feche a torneira ao escovar os dentes, e avise a portaria/administração " +
      "se notar vazamentos em áreas comuns ou na sua unidade. Pequenas atitudes fazem diferença na conta " +
      "de todos.",
  },
  Energia: {
    titulo: "Formas de reduzir o consumo de energia",
    texto:
      "Algumas opções comuns pra reduzir a conta de luz em áreas comuns: trocar lâmpadas por LED, " +
      "instalar sensores de presença em corredores/garagem/escadas, revisar horários de temporizadores " +
      "externos, avaliar energia solar se houver espaço. Considere um orçamento com fornecedor " +
      "especializado antes de decidir.",
    avisoTitulo: "Campanha de economia de energia",
    avisoTexto:
      "Moradores, o consumo de energia das áreas comuns aumentou recentemente. Pedimos atenção a hábitos " +
      "simples: apague luzes ao sair de ambientes comuns, evite acionar portões/portas elétricas sem " +
      "necessidade, e avise a administração sobre lâmpadas ou equipamentos com mau funcionamento. Estamos " +
      "avaliando melhorias (como iluminação LED) para reduzir esse custo no longo prazo.",
  },
};

function ano(data) {
  return data ? new Date(data).getFullYear() : null;
}

function media(lista) {
  if (!lista.length) return 0;
  return lista.reduce((s, v) => s + v, 0) / lista.length;
}

function jaTratado(tratados, tipo, chave) {
  return tratados.some((t) => t.tipo === tipo && t.chave === chave);
}

// Alertas de fornecedor: "sem cotação concorrente" (reforçado quando
// também subiu de valor) e prompt de "marcar como confiança". Só olha
// categorias onde o condomínio nunca trocou de fornecedor (um único
// fornecedor_id na categoria inteira) — trocar já é, por si, uma forma
// de ter comparado preço.
function alertasDeFornecedor({ contasPagas, fornecedores, condominio, tratados }) {
  const porCategoria = new Map();
  for (const c of contasPagas) {
    if (!c.categoria || !c.fornecedor_id) continue;
    if (!porCategoria.has(c.categoria)) porCategoria.set(c.categoria, new Map());
    const porFornecedor = porCategoria.get(c.categoria);
    if (!porFornecedor.has(c.fornecedor_id)) porFornecedor.set(c.fornecedor_id, []);
    porFornecedor.get(c.fornecedor_id).push(c);
  }

  const alertas = [];
  const anosSemCotacao = condominio?.fin_alerta_sem_cotacao_anos ?? 2;
  const percentualAumento = condominio?.fin_alerta_aumento_percentual ?? 15;
  const renovacoesConfianca = condominio?.fin_confianca_renovacoes ?? 3;

  for (const [categoria, porFornecedor] of porCategoria) {
    if (porFornecedor.size !== 1) continue; // já trocou de fornecedor alguma vez — não entra no alerta
    const [fornecedorId, contas] = porFornecedor.entries().next().value;
    const fornecedor = fornecedores.find((f) => f.id === fornecedorId);
    if (!fornecedor || fornecedor.eh_concessionaria) continue;

    const anosComHistorico = new Set(contas.map((c) => ano(c.data_competencia || c.data_pagamento)).filter(Boolean));
    const anoMaisRecente = Math.max(...anosComHistorico);
    const recentes = contas.filter((c) => ano(c.data_competencia || c.data_pagamento) === anoMaisRecente);
    const anteriores = contas.filter((c) => ano(c.data_competencia || c.data_pagamento) !== anoMaisRecente);

    let percentual = null;
    let valorAnterior = null;
    let valorAtual = null;
    if (anteriores.length > 0) {
      valorAnterior = media(anteriores.map((c) => Number(c.valor) || 0));
      valorAtual = media(recentes.map((c) => Number(c.valor) || 0));
      if (valorAnterior > 0) percentual = ((valorAtual - valorAnterior) / valorAnterior) * 100;
    }
    const reforcado = percentual != null && percentual >= percentualAumento;

    if (anosComHistorico.size >= anosSemCotacao) {
      const chave = fornecedorId;
      if (!jaTratado(tratados, "fornecedor_sem_cotacao", chave)) {
        alertas.push({
          tipo: "fornecedor_sem_cotacao",
          chave,
          reforcado,
          categoria,
          fornecedorId,
          fornecedorNome: fornecedor.razao_social,
          anos: anosComHistorico.size,
          percentual: percentual != null ? Math.round(percentual) : null,
          valorAnterior,
          valorAtual,
        });
      }
    }

    if (anosComHistorico.size >= renovacoesConfianca && !fornecedor.confianca) {
      const chave = fornecedorId;
      if (!jaTratado(tratados, "fornecedor_confianca_prompt", chave)) {
        alertas.push({
          tipo: "fornecedor_confianca_prompt",
          chave,
          categoria,
          fornecedorId,
          fornecedorNome: fornecedor.razao_social,
          quantidade: anosComHistorico.size,
        });
      }
    }
  }

  return alertas;
}

// Salto de valor em conta de consumo (água/energia) — compara o mês
// mais recente pago com a média dos meses anteriores da mesma
// categoria. Não depende de fornecedor vinculado (muitos síndicos só
// lançam a despesa, sem cadastrar a concessionária como fornecedor).
function alertasDeConsumo({ contasPagas, condominio, tratados }) {
  const percentualAumento = condominio?.fin_alerta_aumento_percentual ?? 15;
  const alertas = [];

  for (const categoria of CATEGORIAS_CONSUMO) {
    const contas = contasPagas.filter((c) => c.categoria === categoria && (c.data_competencia || c.data_pagamento));
    const porMes = new Map();
    for (const c of contas) {
      const competencia = (c.data_competencia || c.data_pagamento).slice(0, 7); // "YYYY-MM"
      if (!porMes.has(competencia)) porMes.set(competencia, []);
      porMes.get(competencia).push(Number(c.valor) || 0);
    }
    const meses = Array.from(porMes.keys()).sort();
    if (meses.length < 4) continue; // histórico curto demais pra confiar na média

    const mesRecente = meses.at(-1);
    const valorRecente = media(porMes.get(mesRecente));
    const mesesAnteriores = meses.slice(0, -1);
    const valorMedioAnterior = media(mesesAnteriores.flatMap((m) => porMes.get(m)));
    if (valorMedioAnterior <= 0) continue;

    const percentual = ((valorRecente - valorMedioAnterior) / valorMedioAnterior) * 100;
    if (percentual < percentualAumento) continue;

    const chave = `${categoria}:${mesRecente}`;
    if (jaTratado(tratados, "conta_consumo_salto", chave)) continue;

    alertas.push({
      tipo: "conta_consumo_salto",
      chave,
      categoria,
      competencia: mesRecente,
      percentual: Math.round(percentual),
      valorAnterior: valorMedioAnterior,
      valorAtual: valorRecente,
    });
  }

  return alertas;
}

export function calcularAlertasFinanceiros({ contasPagar, fornecedores, condominio, tratados }) {
  const contasPagas = (contasPagar || []).filter((c) => c.status === "pago");
  const listaFornecedores = fornecedores || [];
  const listaTratados = tratados || [];
  return [
    ...alertasDeFornecedor({ contasPagas, fornecedores: listaFornecedores, condominio, tratados: listaTratados }),
    ...alertasDeConsumo({ contasPagas, condominio, tratados: listaTratados }),
  ];
}

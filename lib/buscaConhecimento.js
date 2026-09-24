// Busca por palavra-chave na base de conhecimento do chatbot — sem IA
// nenhuma, de propósito (Nível 1). Normaliza acento/caixa e pontua
// cada item por FRASE-chave (não por palavra isolada comparada por
// substring) — uma palavra batendo sozinha dentro de uma frase de 3-4
// palavras cadastradas (ex: "funciona" dentro de "login não funciona")
// conta bem menos que bater a frase inteira, e cada palavra pesa mais
// quanto mais rara ela for na base (mesma ideia do IDF de busca de
// texto, calculado na hora sobre os itens carregados). Isso evita que
// palavras genéricas ("sistema") ou coincidências de uma palavra só
// dentro de uma frase maior façam um item errado vencer.
const PALAVRAS_IGNORADAS = new Set([
  "como", "o", "a", "os", "as", "de", "da", "do", "das", "dos", "um", "uma",
  "pra", "para", "que", "e", "eu", "no", "na", "meu", "minha", "faco",
  "fazer", "quero", "gostaria", "por", "favor", "tem", "sobre", "voce", "vc",
]);

// Pequeno dicionário de termos relacionados do domínio do Vizinn — não
// é IA, é uma lista curada pra cobrir formas comuns de perguntar a
// mesma coisa (ex: "pessoa" quase sempre quer dizer "visitante" quando
// combinado com "entrar"). Cresce manualmente conforme surgirem casos
// reais, igual à própria base de conhecimento.
const SINONIMOS = {
  pessoa: ["visitante"],
  gente: ["visitante"],
  entrar: ["visita", "acesso"],
  entrada: ["acesso"],
  acessar: ["login", "entrar"],
  logar: ["login"],
  travou: ["bloqueado", "erro"],
  reclamacao: ["ocorrencia"],
  problema: ["ocorrencia", "chamado"],
};

// Perguntas que são só isso (sem nenhum assunto novo) são tratadas
// como continuação da última resposta, não como pergunta desconhecida.
const PALAVRAS_CONTINUACAO = new Set(["depois", "entao", "agora", "mais", "isso", "ai", "dai"]);

const COBERTURA_MINIMA = 0.4;
const PONTUACAO_MINIMA = 1;

function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function tokenizar(texto) {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((palavra) => palavra.length > 1 && !PALAVRAS_IGNORADAS.has(palavra));
}

function expandirTermos(termos) {
  return termos.map((termo) => [termo, [termo, ...(SINONIMOS[termo] || [])]]);
}

function construirIndice(itens) {
  return itens.map((item) => ({
    item,
    frasesChave: (item.palavras_chave || []).map((frase) => tokenizar(frase)).filter((f) => f.length > 0),
    palavrasTexto: new Set(tokenizar(`${item.titulo} ${item.resposta_curta}`)),
  }));
}

// Em quantos itens cada palavra aparece (frase-chave ou texto) — usado
// pra dar menos peso a palavras genéricas e mais peso a palavras
// específicas de um único item.
function construirDf(indice) {
  const df = new Map();
  for (const { frasesChave, palavrasTexto } of indice) {
    const palavrasDoItem = new Set(palavrasTexto);
    for (const frase of frasesChave) for (const p of frase) palavrasDoItem.add(p);
    for (const p of palavrasDoItem) df.set(p, (df.get(p) || 0) + 1);
  }
  return df;
}

function idf(palavra, df, totalItens) {
  const freq = df.get(palavra) || totalItens;
  return Math.log(1 + totalItens / freq);
}

export function buscarMelhorResposta(pergunta, itens) {
  const termosOriginais = tokenizar(pergunta);
  if (termosOriginais.length === 0 || !itens || itens.length === 0) return null;

  const termosExpandidos = expandirTermos(termosOriginais);
  const indice = construirIndice(itens);
  const df = construirDf(indice);
  const totalItens = itens.length;

  let melhor = null;
  let melhorPontuacao = 0;

  for (const { item, frasesChave, palavrasTexto } of indice) {
    let pontuacao = 0;
    const termosCobertos = new Set();

    // Pontuação por frase-chave cadastrada: o quanto da frase a
    // pergunta cobre decide o peso — uma palavra isolada batendo
    // dentro de uma frase maior conta bem menos que bater a frase
    // inteira.
    for (const frase of frasesChave) {
      let sobrepostas = 0;
      let somaIdf = 0;
      for (const [termo, expansoes] of termosExpandidos) {
        const bateu = expansoes.find((exp) => frase.includes(exp));
        if (bateu) {
          sobrepostas += 1;
          somaIdf += idf(bateu, df, totalItens);
          termosCobertos.add(termo);
        }
      }
      if (sobrepostas > 0) {
        const fracaoFrase = sobrepostas / frase.length;
        pontuacao += 3 * fracaoFrase * (somaIdf / sobrepostas);
      }
    }

    // Pontuação por texto corrido (título + resposta) — peso menor,
    // palavra a palavra.
    for (const [termo, expansoes] of termosExpandidos) {
      const bateu = expansoes.find((exp) => palavrasTexto.has(exp));
      if (bateu) {
        pontuacao += 1 * idf(bateu, df, totalItens);
        termosCobertos.add(termo);
      }
    }

    const cobertura = termosCobertos.size / termosOriginais.length;

    // Piso de confiança: sem cobrir uma fração mínima da pergunta ou
    // sem pontuação relevante, não é resposta confiável — melhor "não
    // sei" do que arriscar.
    if (pontuacao > melhorPontuacao && cobertura >= COBERTURA_MINIMA && pontuacao >= PONTUACAO_MINIMA) {
      melhorPontuacao = pontuacao;
      melhor = item;
    }
  }

  return melhor;
}

// "E depois?", "E agora?"... não é memória de conversa de verdade — é
// uma regra simples: se a pergunta inteira é só palavra de
// continuação, sem nenhum assunto novo, trata como "continua o que a
// gente estava falando" em vez de cair no "não sei".
export function ehPerguntaDeContinuacao(pergunta) {
  const termos = tokenizar(pergunta);
  return termos.length > 0 && termos.every((t) => PALAVRAS_CONTINUACAO.has(t));
}

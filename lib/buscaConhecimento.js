// Busca por palavra-chave na base de conhecimento do chatbot — sem IA
// nenhuma, de propósito (Nível 1). Normaliza acento/caixa e pontua por
// quantas palavras da pergunta aparecem no título/resposta/palavras-
// chave de cada item; palavras-chave cadastradas valem mais que texto
// corrido. Suficiente pra uma base de algumas dezenas/centenas de
// itens — não precisa de banco vetorial nessa escala.
const PALAVRAS_IGNORADAS = new Set([
  "como", "o", "a", "os", "as", "de", "da", "do", "das", "dos", "um", "uma",
  "pra", "para", "que", "e", "eu", "no", "na", "meu", "minha", "e", "faco",
  "fazer", "quero", "gostaria", "por", "favor", "tem", "sobre",
]);

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

export function buscarMelhorResposta(pergunta, itens) {
  const termos = tokenizar(pergunta);
  if (termos.length === 0) return null;

  let melhor = null;
  let melhorPontuacao = 0;

  for (const item of itens) {
    const textoBase = normalizar(`${item.titulo} ${item.resposta_curta}`);
    const chaves = (item.palavras_chave || []).map(normalizar);

    let pontuacao = 0;
    for (const termo of termos) {
      if (chaves.some((chave) => chave.includes(termo) || termo.includes(chave))) {
        pontuacao += 3;
      } else if (textoBase.includes(termo)) {
        pontuacao += 1;
      }
    }

    if (pontuacao > melhorPontuacao) {
      melhorPontuacao = pontuacao;
      melhor = item;
    }
  }

  return melhorPontuacao > 0 ? melhor : null;
}

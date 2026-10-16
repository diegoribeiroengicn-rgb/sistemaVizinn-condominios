import { NextResponse } from "next/server";

// Limitador simples por IP, em memória — não precisa de nenhum serviço
// externo (Redis/Upstash) pra já reduzir abuso casual nas rotas públicas
// mais sensíveis (formulário de contato, chat, pagamento). Limitação
// conhecida: cada instância serverless tem sua própria memória, então
// não é um limite global exato — é uma barreira "melhor que nada", não
// a solução definitiva (essa exigiria um contador compartilhado).
const janelas = new Map();

const LIMPEZA_INTERVALO_MS = 5 * 60 * 1000;
let ultimaLimpeza = Date.now();

function limparAntigos(agora) {
  if (agora - ultimaLimpeza < LIMPEZA_INTERVALO_MS) return;
  ultimaLimpeza = agora;
  for (const [chave, timestamps] of janelas) {
    const recentes = timestamps.filter((t) => agora - t < 60 * 60 * 1000);
    if (recentes.length === 0) janelas.delete(chave);
    else janelas.set(chave, recentes);
  }
}

function obterIp(request) {
  const encaminhado = request.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "desconhecido";
}

/**
 * @param {string} chave identifica a rota (ex.: "contato")
 * @param {number} limite quantas requisições permitidas na janela
 * @param {number} janelaMs duração da janela em milissegundos
 */
export function limitarTaxa(request, { chave, limite, janelaMs }) {
  const agora = Date.now();
  limparAntigos(agora);
  const chaveCompleta = `${chave}:${obterIp(request)}`;
  const timestamps = janelas.get(chaveCompleta) || [];
  const recentes = timestamps.filter((t) => agora - t < janelaMs);

  if (recentes.length >= limite) {
    const retryAfterSegundos = Math.max(1, Math.ceil((recentes[0] + janelaMs - agora) / 1000));
    return { permitido: false, retryAfterSegundos };
  }

  recentes.push(agora);
  janelas.set(chaveCompleta, recentes);
  return { permitido: true };
}

export function respostaLimiteExcedido(retryAfterSegundos) {
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde um pouco e tente de novo." },
    { status: 429, headers: { "Retry-After": String(retryAfterSegundos) } }
  );
}

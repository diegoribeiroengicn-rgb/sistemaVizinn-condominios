// Cadastro de Moradores — unidade/bloco/nome/telefone de quem mora no
// condomínio, separado de `membros` (quem tem login no Vizinn). Alimenta
// as notificações de Ocorrências (ver /app/api/notificar), que agora
// avisam qualquer morador cadastrado aqui, não só quem tem login.

// Cabeçalhos aceitos por coluna, em minúsculo e sem acento — cobre as
// variações mais comuns de planilha (síndico pode chamar "apto" em vez
// de "unidade", por exemplo).
const CABECALHOS = {
  unidade: ["unidade", "unid", "apto", "apartamento", "casa", "numero", "número"],
  bloco: ["bloco", "torre", "quadra"],
  nome: ["nome", "morador", "residente", "nome completo"],
  telefone: ["telefone", "celular", "whatsapp", "fone", "contato"],
  email: ["email", "e-mail"],
};

function normalizarCabecalho(texto) {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function detectarSeparador(primeiraLinha) {
  const contagens = [",", ";", "\t"].map((sep) => ({
    sep,
    n: primeiraLinha.split(sep).length,
  }));
  contagens.sort((a, b) => b.n - a.n);
  return contagens[0].n > 1 ? contagens[0].sep : ",";
}

// Parser simples de CSV com suporte a campos entre aspas (pra nomes com
// vírgula) — não usa nenhuma lib externa, então não carrega dependências
// com vulnerabilidades conhecidas só pra ler uma planilha.
function parseLinhaCsv(linha, separador) {
  const campos = [];
  let atual = "";
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (dentroAspas) {
      if (c === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (c === '"') {
        dentroAspas = false;
      } else {
        atual += c;
      }
    } else if (c === '"') {
      dentroAspas = true;
    } else if (c === separador) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

// Lê o texto de um .csv (exportado do Excel/Google Sheets) e devolve
// { linhas, erros } — linhas já mapeadas pros campos unidade/bloco/nome/
// telefone/email, prontas pra revisão antes de importar.
export function parseMoradoresCsv(texto) {
  const linhasBrutas = texto
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (linhasBrutas.length === 0) {
    return { linhas: [], erros: ["Arquivo vazio."] };
  }

  const separador = detectarSeparador(linhasBrutas[0]);
  const cabecalho = parseLinhaCsv(linhasBrutas[0], separador).map(normalizarCabecalho);

  const indicePorCampo = {};
  for (const [campo, variacoes] of Object.entries(CABECALHOS)) {
    const idx = cabecalho.findIndex((h) => variacoes.includes(h));
    if (idx >= 0) indicePorCampo[campo] = idx;
  }

  if (indicePorCampo.unidade === undefined || indicePorCampo.nome === undefined) {
    return {
      linhas: [],
      erros: [
        'Não encontrei as colunas obrigatórias "unidade" e "nome" no arquivo. Confira o cabeçalho da primeira linha.',
      ],
    };
  }

  const linhas = [];
  const erros = [];
  for (let i = 1; i < linhasBrutas.length; i++) {
    const campos = parseLinhaCsv(linhasBrutas[i], separador);
    const unidade = campos[indicePorCampo.unidade]?.trim() || "";
    const nome = campos[indicePorCampo.nome]?.trim() || "";
    if (!unidade || !nome) {
      erros.push(`Linha ${i + 1}: faltando unidade ou nome — ignorada.`);
      continue;
    }
    linhas.push({
      unidade,
      bloco: indicePorCampo.bloco !== undefined ? campos[indicePorCampo.bloco]?.trim() || "" : "",
      nome,
      telefone: indicePorCampo.telefone !== undefined ? campos[indicePorCampo.telefone]?.trim() || "" : "",
      email: indicePorCampo.email !== undefined ? campos[indicePorCampo.email]?.trim() || "" : "",
    });
  }

  return { linhas, erros };
}

// Gera o CSV de modelo (com um exemplo) pra download — ajuda quem nunca
// preencheu uma planilha assim a saber o formato esperado.
export function gerarModeloCsv() {
  const linhas = [
    ["unidade", "bloco", "nome", "telefone", "email"],
    ["101", "A", "Maria Silva", "11999998888", "maria@email.com"],
  ];
  return linhas.map((l) => l.join(",")).join("\r\n");
}
